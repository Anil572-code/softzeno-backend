import { Injectable, NotFoundException } from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';

const DEMO_BUSINESS_ID = 'softzeno-demo-business';

type SettlementBadge =
  | 'Paid'
  | 'Credit Open'
  | 'Partially Cleared'
  | 'Cleared'
  | 'Voided';

@Injectable()
export class InvoiceRegisterService {
  constructor(private readonly prisma: PrismaService) {}

  private roundMoney(value: number) {
    return Math.round((value + Number.EPSILON) * 100) / 100;
  }

  private async getCreditSettlement(invoiceId: string) {
    const creditEntry = await this.prisma.ledgerEntry.findFirst({
      where: {
        invoiceId,
        kind: 'PosCreditBill',
        isVoided: false,
      },
    });

    if (!creditEntry) {
      return {
        creditClearedAmount: 0,
        creditRemainingAmount: 0,
      };
    }

    const allocations = await this.prisma.ledgerAllocation.findMany({
      where: {
        targetEntryId: creditEntry.id,
      },
    });

    const creditAmount = Number(creditEntry.debit);
    const clearedAmount = allocations.reduce(
      (sum, allocation) => sum + Number(allocation.appliedAmount),
      0,
    );

    return {
      creditClearedAmount: this.roundMoney(clearedAmount),
      creditRemainingAmount: this.roundMoney(creditAmount - clearedAmount),
    };
  }

  private getSettlementBadge(params: {
    paymentStatus: string;
    creditAmount: number;
    creditRemainingAmount: number;
  }): SettlementBadge {
    if (params.paymentStatus === 'Voided') return 'Voided';

    if (params.creditAmount <= 0) return 'Paid';

    if (params.creditRemainingAmount <= 0) return 'Cleared';

    if (params.creditRemainingAmount < params.creditAmount) {
      return 'Partially Cleared';
    }

    return 'Credit Open';
  }

  async getRegister() {
    const invoices = await this.prisma.invoice.findMany({
      where: {
        businessId: DEMO_BUSINESS_ID,
      },
      orderBy: {
        finalizedAt: 'desc',
      },
      include: {
        items: true,
      },
      take: 100,
    });

    const rows = await Promise.all(
      invoices.map(async (invoice) => {
        const creditAmount = Number(invoice.creditAmount);
        const settlement = await this.getCreditSettlement(invoice.id);

        return {
          id: invoice.id,
          invoiceNumber: invoice.invoiceNumber,
          invoiceDate: invoice.finalizedAt,
          invoiceType: invoice.invoiceType,
          status: invoice.status,

          customer: {
            id: invoice.customerId,
            name: invoice.customerName,
            phone: invoice.customerPhone,
            panVat: invoice.customerPanVat,
          },

          table: {
            id: invoice.tableId,
            name: invoice.tableName,
          },

          totals: {
            grossTotal: Number(invoice.grossTotal),
            discountAmount: Number(invoice.discountAmount),
            taxableSubtotal: Number(invoice.taxableSubtotal),
            vatRate: Number(invoice.vatRate),
            vatAmount: Number(invoice.vatAmount),
            grandTotal: Number(invoice.grandTotal),
          },

          payment: {
            paymentMode: invoice.paymentMode,
            paymentStatus: invoice.paymentStatus,
            paidAmount: Number(invoice.paidAmount),
            creditAmount,
            creditClearedAmount: settlement.creditClearedAmount,
            creditRemainingAmount: settlement.creditRemainingAmount,
            settlementBadge: this.getSettlementBadge({
              paymentStatus: invoice.paymentStatus,
              creditAmount,
              creditRemainingAmount: settlement.creditRemainingAmount,
            }),
          },

          cbms: {
            status: invoice.cbmsStatus,
            syncedAt: invoice.cbmsSyncedAt,
            responseCode: invoice.cbmsResponseCode,
            errorMessage: invoice.cbmsErrorMessage,
            retryCount: invoice.cbmsRetryCount,
          },

          print: {
            printCount: invoice.printCount,
            lastPrintedAt: invoice.lastPrintedAt,
          },

          itemCount: invoice.items.length,
          immutableHash: invoice.immutableHash,
        };
      }),
    );

    return {
      total: rows.length,
      rows,
    };
  }

  async getRegisterDetail(invoiceId: string) {
    const invoice = await this.prisma.invoice.findUnique({
      where: {
        id: invoiceId,
      },
      include: {
        items: true,
      },
    });

    if (!invoice) {
      throw new NotFoundException('Invoice was not found.');
    }

    const settlement = await this.getCreditSettlement(invoice.id);
    const creditAmount = Number(invoice.creditAmount);

    const cbmsLogs = await this.prisma.cbmsSyncLog.findMany({
      where: {
        invoiceId: invoice.id,
      },
      orderBy: {
        attemptedAt: 'desc',
      },
    });

    const paymentReceipts = await this.prisma.paymentReceipt.findMany({
      where: {
        invoiceId: invoice.id,
      },
      orderBy: {
        receivedAt: 'desc',
      },
      include: {
        parts: true,
      },
    });

    const ledgerEntry = await this.prisma.ledgerEntry.findFirst({
      where: {
        invoiceId: invoice.id,
        kind: 'PosCreditBill',
        isVoided: false,
      },
    });

    const allocations = ledgerEntry
      ? await this.prisma.ledgerAllocation.findMany({
          where: {
            targetEntryId: ledgerEntry.id,
          },
          orderBy: {
            createdAt: 'asc',
          },
        })
      : [];

    return {
      invoice,
      items: invoice.items,
      paymentReceipts,
      ledger: {
        creditEntry: ledgerEntry,
        allocations,
        creditClearedAmount: settlement.creditClearedAmount,
        creditRemainingAmount: settlement.creditRemainingAmount,
        settlementBadge: this.getSettlementBadge({
          paymentStatus: invoice.paymentStatus,
          creditAmount,
          creditRemainingAmount: settlement.creditRemainingAmount,
        }),
      },
      cbmsLogs,
    };
  }
}
