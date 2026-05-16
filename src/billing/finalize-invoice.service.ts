import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  InventoryReservationStatus,
  InventoryStockActionType,
  Prisma,
} from '@prisma/client';
import { createHash } from 'crypto';

import { PrismaService } from '../prisma/prisma.service';
import { BillingTotalService } from './billing-total.service';
import { FinalizeInvoiceDto } from './dto/finalize-invoice.dto';

const DEMO_BUSINESS_ID = 'softzeno-demo-business';
const DEMO_BRANCH_CODE = 'BHR';
const DEMO_TERMINAL_CODE = 'POS-01';
const DEMO_ADMIN_USERNAME = '@admin';
const TAX_INVOICE_TYPE = 'TaxInvoice';

@Injectable()
export class FinalizeInvoiceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly billingTotalService: BillingTotalService,
  ) {}

  private roundMoney(value: number) {
    return Math.round((value + Number.EPSILON) * 100) / 100;
  }

  private formatInvoiceNumber(prefix: string, sequence: number) {
    return `${prefix}-${String(sequence).padStart(6, '0')}`;
  }

  private moneyEquals(left: number, right: number) {
    return Math.abs(this.roundMoney(left) - this.roundMoney(right)) <= 0.01;
  }

  private buildImmutableHash(payload: Record<string, unknown>) {
    return createHash('sha256').update(JSON.stringify(payload)).digest('hex');
  }

  private getPaymentMode(paidAmount: number, creditAmount: number) {
    if (creditAmount > 0 && paidAmount > 0) return 'Mixed';
    if (creditAmount > 0) return 'Credit';

    return 'Cash';
  }

  private isRealMenuItemId(value?: string | null) {
    if (!value) return false;
    if (value.startsWith('CUSTOM-')) return false;
    if (value.startsWith('MOCK-')) return false;

    return true;
  }

  private async decreaseMenuItemStock(
    tx: Prisma.TransactionClient,
    items: FinalizeInvoiceDto['items'],
  ) {
    const stockItems = items.filter((item) => this.isRealMenuItemId(item.id));

    if (stockItems.length === 0) return;

    for (const item of stockItems) {
      const menuItem = await tx.menuItem.findUnique({
        where: {
          id: item.id,
        },
        select: {
          id: true,
          stock: true,
        },
      });

      if (!menuItem || menuItem.stock === null) continue;

      await tx.menuItem.update({
        where: {
          id: menuItem.id,
        },
        data: {
          stock: Math.max(0, menuItem.stock - item.qty),
        },
      });
    }
  }
  private roundStock(value: number) {
    return Math.round((value + Number.EPSILON) * 10000) / 10000;
  }

  private async decreaseRecipeIngredientStock(
    tx: Prisma.TransactionClient,
    params: {
      businessId: string;
      invoiceNumber: string;
      items: FinalizeInvoiceDto['items'];
      performedBy: string;
    },
  ) {
    const soldMenuItems = params.items.filter((item) =>
      this.isRealMenuItemId(item.id),
    );

    if (soldMenuItems.length === 0) return [];

    const soldQtyByMenuItemId = new Map<string, number>();

    for (const item of soldMenuItems) {
      soldQtyByMenuItemId.set(
        item.id,
        (soldQtyByMenuItemId.get(item.id) ?? 0) + item.qty,
      );
    }

    const recipeIngredients = await tx.menuItemRecipeIngredient.findMany({
      where: {
        businessId: params.businessId,
        menuItemId: {
          in: Array.from(soldQtyByMenuItemId.keys()),
        },
        isActive: true,
      },
      include: {
        menuItem: {
          select: {
            id: true,
            name: true,
          },
        },
        inventoryItem: {
          select: {
            id: true,
            name: true,
            unit: true,
            currentStock: true,
            supplierId: true,
            trackBatch: true,
            isTrashed: true,
          },
        },
      },
    });

    if (recipeIngredients.length === 0) return [];

    const deductionByInventoryItemId = new Map<
      string,
      {
        itemId: string;
        itemName: string;
        unit: string;
        supplierId: string | null;
        quantity: number;
        sources: string[];
      }
    >();

    for (const ingredient of recipeIngredients) {
      const soldQty = soldQtyByMenuItemId.get(ingredient.menuItemId) ?? 0;
      const recipeQty = Number(ingredient.quantity);
      const wastePercent = Number(ingredient.wastePercent ?? 0);

      const deductionQty = this.roundStock(
        soldQty * recipeQty * (1 + wastePercent / 100),
      );

      if (deductionQty <= 0) continue;

      const existing = deductionByInventoryItemId.get(
        ingredient.inventoryItemId,
      );

      const source = `${ingredient.menuItem.name} x ${soldQty}`;

      if (existing) {
        existing.quantity = this.roundStock(existing.quantity + deductionQty);
        existing.sources.push(source);
      } else {
        deductionByInventoryItemId.set(ingredient.inventoryItemId, {
          itemId: ingredient.inventoryItemId,
          itemName: ingredient.inventoryItem.name,
          unit: ingredient.inventoryItem.unit,
          supplierId: ingredient.inventoryItem.supplierId,
          quantity: deductionQty,
          sources: [source],
        });
      }
    }

    const deductions = Array.from(deductionByInventoryItemId.values());

    for (const deduction of deductions) {
      const inventoryItem = await tx.inventoryItem.findFirst({
        where: {
          id: deduction.itemId,
          businessId: params.businessId,
        },
      });

      if (!inventoryItem) {
        throw new BadRequestException(
          `Inventory item ${deduction.itemName} was not found.`,
        );
      }

      if (inventoryItem.isTrashed) {
        throw new BadRequestException(
          `Inventory item ${inventoryItem.name} is trashed and cannot be deducted.`,
        );
      }

      const beforeStock = Number(inventoryItem.currentStock);
      const afterStock = this.roundStock(beforeStock - deduction.quantity);

      if (afterStock < 0) {
        throw new BadRequestException(
          `Insufficient stock for ${inventoryItem.name}. Available ${beforeStock} ${inventoryItem.unit}, required ${deduction.quantity} ${inventoryItem.unit}.`,
        );
      }

      await tx.inventoryItem.update({
        where: {
          id: inventoryItem.id,
        },
        data: {
          currentStock: new Prisma.Decimal(afterStock),
          lastMovementAt: new Date(),
        },
      });

      await tx.inventoryStockMovement.create({
        data: {
          businessId: params.businessId,
          itemId: inventoryItem.id,
          supplierId: inventoryItem.supplierId,
          actionType: InventoryStockActionType.Reduce,
          quantity: new Prisma.Decimal(deduction.quantity),
          unit: inventoryItem.unit,
          beforeStock: new Prisma.Decimal(beforeStock),
          afterStock: new Prisma.Decimal(afterStock),
          reason: 'POS invoice auto deduction',
          note: `Invoice ${params.invoiceNumber}. ${deduction.sources.join(', ')}`,
          performedBy: params.performedBy,
        },
      });
    }

    return deductions;
  }
  private async consumeReservedInventoryForOrder(
    tx: Prisma.TransactionClient,
    params: {
      businessId: string;
      orderId?: string;
      invoiceNumber: string;
    },
  ) {
    if (!params.orderId) return [];

    const reservations = await tx.inventoryReservation.findMany({
      where: {
        businessId: params.businessId,
        orderId: params.orderId,
        status: InventoryReservationStatus.Reserved,
      },
    });

    if (reservations.length === 0) return [];

    await tx.inventoryReservation.updateMany({
      where: {
        businessId: params.businessId,
        orderId: params.orderId,
        status: InventoryReservationStatus.Reserved,
      },
      data: {
        status: InventoryReservationStatus.Consumed,
        consumedAt: new Date(),
        reason: `Consumed by invoice ${params.invoiceNumber}`,
      },
    });

    return reservations.map((reservation) => ({
      itemId: reservation.inventoryItemId,
      itemName: reservation.inventoryName,
      unit: reservation.unit,
      quantity: Number(reservation.quantity),
      sources: [`${reservation.menuItemName} reservation`],
    }));
  }

  async finalizeInvoice(payload: FinalizeInvoiceDto) {
    const totals = this.billingTotalService.calculateTotals({
      items: payload.items.map((item) => ({
        id: item.id,
        name: item.name,
        qty: item.qty,
        rate: item.rate,
      })),
      discountAmount: payload.discountAmount ?? 0,
      vatRate: payload.vatRate ?? 13,
    });

    const payments = payload.payments ?? [];
    const paidAmount = this.roundMoney(
      payments.reduce((sum, payment) => sum + payment.amount, 0),
    );
    const creditAmount = this.roundMoney(payload.credit?.amount ?? 0);

    if (!this.moneyEquals(paidAmount + creditAmount, totals.grandTotal)) {
      throw new BadRequestException(
        `Paid amount + credit amount must equal grand total. Expected ${totals.grandTotal}, received ${this.roundMoney(
          paidAmount + creditAmount,
        )}.`,
      );
    }

    if (creditAmount > 0 && !payload.credit) {
      throw new BadRequestException('Credit details are required.');
    }

    if (payments.length === 0 && creditAmount <= 0) {
      throw new BadRequestException('Payment or credit is required.');
    }

    const result = await this.prisma.$transaction(async (tx) => {
      const business = await tx.business.findUnique({
        where: {
          id: DEMO_BUSINESS_ID,
        },
      });

      if (!business) {
        throw new NotFoundException('Demo business was not found.');
      }

      const branch = await tx.branch.findFirst({
        where: {
          businessId: business.id,
          code: DEMO_BRANCH_CODE,
          isActive: true,
        },
      });

      if (!branch) {
        throw new NotFoundException('Demo branch was not found.');
      }

      const terminal = await tx.terminal.findFirst({
        where: {
          businessId: business.id,
          branchId: branch.id,
          code: DEMO_TERMINAL_CODE,
          isActive: true,
        },
      });

      if (!terminal) {
        throw new NotFoundException('Demo terminal was not found.');
      }

      const actor = await tx.user.findFirst({
        where: {
          businessId: business.id,
          username: DEMO_ADMIN_USERNAME,
          status: 'Active',
          isDeleted: false,
        },
        include: {
          role: true,
        },
      });

      if (!actor) {
        throw new NotFoundException('Demo admin user was not found.');
      }
      const cashierId = actor.id;
      const cashierName =
        `${actor.firstName ?? ''} ${actor.lastName ?? ''}`.trim() ||
        actor.username ||
        'Softzeno Admin';

      const fiscalYear = await tx.fiscalYear.findFirst({
        where: {
          businessId: business.id,
          branchId: branch.id,
          status: 'Open',
        },
        orderBy: {
          startsAt: 'desc',
        },
      });

      if (!fiscalYear) {
        throw new BadRequestException('No open fiscal year found.');
      }

      const sequence = await tx.invoiceSequence.findFirst({
        where: {
          businessId: business.id,
          branchId: branch.id,
          fiscalYearId: fiscalYear.id,
          invoiceType: TAX_INVOICE_TYPE,
          locked: false,
        },
      });

      if (!sequence) {
        throw new BadRequestException('Invoice sequence was not found.');
      }

      const nextSequence = sequence.currentSequence + 1;
      const invoiceNumber = this.formatInvoiceNumber(
        sequence.prefix,
        nextSequence,
      );

      await tx.invoiceSequence.update({
        where: {
          id: sequence.id,
        },
        data: {
          currentSequence: nextSequence,
          lastInvoiceNumber: invoiceNumber,
        },
      });

      const paymentStatus =
        creditAmount > 0
          ? paidAmount > 0
            ? 'CreditPartiallyCleared'
            : 'CreditOpen'
          : 'Paid';

      const immutableHash = this.buildImmutableHash({
        invoiceNumber,
        orderId: payload.orderId,
        grossTotal: totals.grossTotal,
        taxableSubtotal: totals.taxableSubtotal,
        vatAmount: totals.vatAmount,
        grandTotal: totals.grandTotal,
        paidAmount,
        creditAmount,
      });

      const invoice = await tx.invoice.create({
        data: {
          businessId: business.id,
          branchId: branch.id,
          terminalId: terminal.id,
          fiscalYearId: fiscalYear.id,
          invoiceNumber,
          invoiceType: 'TaxInvoice',
          status: 'Finalized',
          paymentStatus,
          paymentMode: this.getPaymentMode(paidAmount, creditAmount),
          orderId: payload.orderId,
          orderNumber: payload.orderNumber,
          tableId: payload.tableId,
          tableName: payload.tableName,
          customerName: payload.customerName,
          customerPhone: payload.customerPhone,
          customerPanVat: payload.customerPanVat,
          grossTotal: totals.grossTotal,
          discountAmount: totals.discountAmount,
          taxableSubtotal: totals.taxableSubtotal,
          vatRate: totals.vatRate,
          vatAmount: totals.vatAmount,
          grandTotal: totals.grandTotal,
          paidAmount,
          creditAmount,
          cashierId,
          cashierName,
          cbmsStatus: 'Pending',
          immutableHash,
        },
      });

      await tx.invoiceItem.createMany({
        data: payload.items.map((item) => {
          const grossAmount = this.roundMoney(item.qty * item.rate);
          const lineShare =
            totals.grossTotal > 0 ? grossAmount / totals.grossTotal : 0;
          const lineDiscount = this.roundMoney(
            totals.discountAmount * lineShare,
          );
          const netAmount = this.roundMoney(grossAmount - lineDiscount);
          const taxableAmount = this.roundMoney(
            netAmount / (1 + totals.vatRate / 100),
          );
          const vatAmount = this.roundMoney(netAmount - taxableAmount);
          const menuItemId = this.isRealMenuItemId(item.id) ? item.id : null;

          return {
            invoiceId: invoice.id,
            menuItemId,
            name: item.name,
            category: item.category,
            qty: item.qty,
            rate: item.rate,
            grossAmount,
            discountAmount: lineDiscount,
            taxableAmount,
            vatAmount,
            netAmount,
            kotNumber: item.kotNumber,
          };
        }),
      });

      let inventoryDeductions: Array<{
        itemId: string;
        itemName: string;
        unit: string;
        quantity: number;
        sources: string[];
      }> = [];

      if (payload.orderId) {
        inventoryDeductions = await this.consumeReservedInventoryForOrder(tx, {
          businessId: business.id,
          orderId: payload.orderId,
          invoiceNumber,
        });

        if (inventoryDeductions.length === 0) {
          throw new BadRequestException(
            'Inventory reservation was not found for this order. Cancel and place the order again before finalizing.',
          );
        }
      } else {
        await this.decreaseMenuItemStock(tx, payload.items);

        inventoryDeductions = await this.decreaseRecipeIngredientStock(tx, {
          businessId: business.id,
          invoiceNumber,
          items: payload.items,
          performedBy: cashierName,
        });
      }

      const paymentReceipt =
        paidAmount > 0
          ? await tx.paymentReceipt.create({
              data: {
                businessId: business.id,
                branchId: branch.id,
                terminalId: terminal.id,
                receiptNumber: `${invoiceNumber}-PAY`,
                source: 'PosInvoice',
                sourceReference: invoiceNumber,
                invoiceId: invoice.id,
                invoiceNumber,
                method: payments.length > 1 ? 'Mixed' : payments[0].method,
                amount: paidAmount,
                receivedAmount: paidAmount,
                changeReturn: 0,
                provider: payments.length === 1 ? payments[0].provider : null,
                referenceNumber:
                  payments.length === 1 ? payments[0].referenceNumber : null,
                bankName: payments.length === 1 ? payments[0].bankName : null,
                status: 'Completed',
                settlementStatus:
                  payments.length === 1 && payments[0].method === 'Cash'
                    ? 'NotRequired'
                    : 'Pending',
                receivedById: cashierId,
                receivedByName: cashierName,
              },
            })
          : null;

      if (paymentReceipt && payments.length > 1) {
        await tx.paymentPart.createMany({
          data: payments.map((payment) => ({
            paymentReceiptId: paymentReceipt.id,
            method: payment.method,
            amount: payment.amount,
            provider: payment.provider,
            referenceNumber: payment.referenceNumber,
            bankName: payment.bankName,
          })),
        });
      }

      let ledgerAccount: Awaited<
        ReturnType<typeof tx.ledgerAccount.findFirst>
      > = null;

      let ledgerEntry: Awaited<ReturnType<typeof tx.ledgerEntry.findFirst>> =
        null;

      if (payload.credit && creditAmount > 0) {
        ledgerAccount =
          (await tx.ledgerAccount.findFirst({
            where: {
              businessId: business.id,
              branchId: branch.id,
              type: payload.credit.accountType,
              name: payload.credit.accountName,
              phone: payload.credit.phone,
              isArchived: false,
            },
          })) ??
          (await tx.ledgerAccount.create({
            data: {
              businessId: business.id,
              branchId: branch.id,
              type: payload.credit.accountType,
              name: payload.credit.accountName,
              phone: payload.credit.phone,
              creditLimit: 0,
              isActive: true,
            },
          }));

        if (ledgerAccount.isCreditBlocked) {
          throw new BadRequestException('Ledger account is credit blocked.');
        }

        ledgerEntry = await tx.ledgerEntry.create({
          data: {
            businessId: business.id,
            branchId: branch.id,
            accountId: ledgerAccount.id,
            reference: invoiceNumber,
            kind: 'PosCreditBill',
            description:
              payload.credit.note ??
              `POS credit bill for invoice ${invoiceNumber}`,
            debit: creditAmount,
            credit: 0,
            handledById: actor.id,
            handledByName: `${actor.firstName} ${actor.lastName}`,
            invoiceId: invoice.id,
            invoiceNumber,
            dueDate: payload.credit.dueDate
              ? new Date(payload.credit.dueDate)
              : null,
          },
        });
      }

      await tx.auditTrail.create({
        data: {
          businessId: business.id,
          branchId: branch.id,
          terminalId: terminal.id,
          action: 'Invoice Finalized',
          entityType: 'Invoice',
          entityId: invoice.id,
          message: `Invoice ${invoiceNumber} finalized.`,
          performedById: actor.id,
          performedByName: `${actor.firstName} ${actor.lastName}`,
          metadata: {
            invoiceNumber,
            grandTotal: totals.grandTotal,
            paidAmount,
            creditAmount,
            paymentMode: this.getPaymentMode(paidAmount, creditAmount),
            inventoryDeductions,
          },
        },
      });

      await tx.cbmsSyncLog.create({
        data: {
          businessId: business.id,
          branchId: branch.id,
          invoiceId: invoice.id,
          invoiceNumber,
          status: 'Pending',
          attemptNumber: 0,
          attemptedById: actor.id,
        },
      });

      const finalizedAt = new Date();

      const posOrder = await tx.posOrder.findFirst({
        where: {
          id: payload.orderId,
          businessId: business.id,
          branchId: branch.id,
          status: {
            in: ['Draft', 'KotSent', 'InProgress'],
          },
        },
      });

      if (posOrder) {
        await tx.posOrder.update({
          where: {
            id: posOrder.id,
          },
          data: {
            status: 'Completed',
            finalizedAt,
            closedById: actor.id,
            closedByName: `${actor.firstName} ${actor.lastName}`,
            invoiceId: invoice.id,
            invoiceNumber,
          },
        });

        if (posOrder.tableId) {
          await tx.restaurantTable.update({
            where: {
              id: posOrder.tableId,
            },
            data: {
              status: 'Free',
              activeOrderId: null,
              activeOrderNumber: null,
              currentGuests: null,
              currentAmount: null,
              lastOrderAt: null,
            },
          });
        }

        await tx.orderEvent.create({
          data: {
            businessId: business.id,
            branchId: branch.id,
            orderId: posOrder.id,
            eventType: 'Created',
            message: `Order ${posOrder.orderNumber} finalized as invoice ${invoiceNumber}.`,
            performedById: actor.id,
            performedByName: `${actor.firstName} ${actor.lastName}`,
            performedAt: finalizedAt,
            metadata: {
              invoiceId: invoice.id,
              invoiceNumber,
              grandTotal: totals.grandTotal,
              paidAmount,
              creditAmount,
            },
          },
        });
      }

      return {
        invoice,
        totals,
        paymentReceipt,
        ledgerAccount,
        ledgerEntry,
        posOrder,
        inventoryDeductions,
        nextPreviewNumber: this.formatInvoiceNumber(
          sequence.prefix,
          nextSequence + 1,
        ),
      };
    });

    return {
      status: 'success',
      data: result,
    };
  }
}
