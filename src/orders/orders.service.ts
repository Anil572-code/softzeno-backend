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

import { PrismaService } from '../prisma/prisma.service';
import { AddOrderItemDto } from './dto/add-order-item.dto';
import { SendKotDto } from './dto/send-kot.dto';
import { VoidOrderItemDto } from './dto/void-order-item.dto';

const ACTIVE_ORDER_STATUSES = ['Draft', 'KotSent', 'InProgress'] as const;
const LIVE_KOT_PARENT_STATUSES: readonly string[] = [
  'Draft',
  'KotSent',
  'InProgress',
];

function roundMoney(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function toDecimal(value: number) {
  return new Prisma.Decimal(roundMoney(value));
}

function toNumber(value: Prisma.Decimal | number | null | undefined) {
  if (value === null || value === undefined) return 0;
  if (typeof value === 'number') return value;

  return Number(value);
}

@Injectable()
export class OrdersService {
  constructor(private readonly prisma: PrismaService) {}

  private async getDemoContext() {
    const business = await this.prisma.business.findFirst({
      orderBy: {
        createdAt: 'asc',
      },
    });

    if (!business) {
      throw new BadRequestException('No business is configured.');
    }

    const branch = await this.prisma.branch.findFirst({
      where: {
        businessId: business.id,
        isActive: true,
      },
      orderBy: {
        createdAt: 'asc',
      },
    });

    return {
      businessId: business.id,
      branchId: branch?.id ?? null,
      terminalId: undefined as string | undefined,
      userId: 'demo-cashier',
      userName: 'Demo Cashier',
    };
  }

  private includeOrderDetails() {
    return {
      items: {
        orderBy: {
          createdAt: 'asc' as const,
        },
      },
      tickets: {
        include: {
          items: true,
        },
        orderBy: {
          sentAt: 'desc' as const,
        },
      },
      events: {
        orderBy: {
          performedAt: 'desc' as const,
        },
        take: 20,
      },
    };
  }
  private isRealMenuItemId(value?: string | null) {
    if (!value) return false;
    if (value.startsWith('CUSTOM-')) return false;
    if (value.startsWith('MOCK-')) return false;

    return true;
  }

  private roundStock(value: number) {
    return Math.round((value + Number.EPSILON) * 10000) / 10000;
  }

  private stockDecimal(value: number) {
    return new Prisma.Decimal(this.roundStock(value));
  }

  private async reserveStockForOrderItems(
    tx: Prisma.TransactionClient,
    params: {
      businessId: string;
      branchId: string | null;
      orderId: string;
      orderNumber: string;
      items: Array<{
        id: string;
        menuItemId: string | null;
        name: string;
        qty: Prisma.Decimal;
      }>;
      performedBy: string;
    },
  ) {
    const realItems = params.items.filter((item) =>
      this.isRealMenuItemId(item.menuItemId),
    );

    if (realItems.length === 0) return;

    const menuItemIds = Array.from(
      new Set(
        realItems
          .map((item) => item.menuItemId)
          .filter((id): id is string => Boolean(id)),
      ),
    );

    const recipeIngredients = await tx.menuItemRecipeIngredient.findMany({
      where: {
        businessId: params.businessId,
        menuItemId: {
          in: menuItemIds,
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
            isTrashed: true,
          },
        },
      },
    });

    if (recipeIngredients.length === 0) return;

    const recipeByMenuItemId = new Map<string, typeof recipeIngredients>();

    for (const ingredient of recipeIngredients) {
      const current = recipeByMenuItemId.get(ingredient.menuItemId) ?? [];
      current.push(ingredient);
      recipeByMenuItemId.set(ingredient.menuItemId, current);
    }

    for (const orderItem of realItems) {
      if (!orderItem.menuItemId) continue;

      const ingredients = recipeByMenuItemId.get(orderItem.menuItemId) ?? [];
      const orderQty = Number(orderItem.qty);

      for (const ingredient of ingredients) {
        const recipeQty = Number(ingredient.quantity);
        const wastePercent = Number(ingredient.wastePercent ?? 0);
        const requiredQty = this.roundStock(
          orderQty * recipeQty * (1 + wastePercent / 100),
        );

        if (requiredQty <= 0) continue;

        const inventoryItem = await tx.inventoryItem.findFirst({
          where: {
            id: ingredient.inventoryItemId,
            businessId: params.businessId,
          },
        });

        if (!inventoryItem) {
          throw new BadRequestException(
            `Inventory item ${ingredient.inventoryItem.name} was not found.`,
          );
        }

        if (inventoryItem.isTrashed) {
          throw new BadRequestException(
            `Inventory item ${inventoryItem.name} is trashed and cannot be reserved.`,
          );
        }

        const beforeStock = Number(inventoryItem.currentStock);
        const afterStock = this.roundStock(beforeStock - requiredQty);

        if (afterStock < 0) {
          throw new BadRequestException(
            `Insufficient stock for ${inventoryItem.name}. Available ${beforeStock} ${inventoryItem.unit}, required ${requiredQty} ${inventoryItem.unit}.`,
          );
        }

        await tx.inventoryItem.update({
          where: {
            id: inventoryItem.id,
          },
          data: {
            currentStock: this.stockDecimal(afterStock),
            lastMovementAt: new Date(),
          },
        });

        await tx.inventoryReservation.create({
          data: {
            businessId: params.businessId,
            branchId: params.branchId,
            orderId: params.orderId,
            orderItemId: orderItem.id,
            menuItemId: orderItem.menuItemId,
            menuItemName: orderItem.name,
            inventoryItemId: inventoryItem.id,
            inventoryName: inventoryItem.name,
            quantity: this.stockDecimal(requiredQty),
            unit: inventoryItem.unit,
            status: InventoryReservationStatus.Reserved,
            reason: `Reserved for ${params.orderNumber}`,
          },
        });

        await tx.inventoryStockMovement.create({
          data: {
            businessId: params.businessId,
            itemId: inventoryItem.id,
            supplierId: inventoryItem.supplierId,
            actionType: InventoryStockActionType.Reserve,
            quantity: this.stockDecimal(requiredQty),
            unit: inventoryItem.unit,
            beforeStock: this.stockDecimal(beforeStock),
            afterStock: this.stockDecimal(afterStock),
            reason: 'POS KOT reservation',
            note: `${params.orderNumber}. ${orderItem.name} x ${orderQty}`,
            performedBy: params.performedBy,
          },
        });
      }
    }
  }

  private async releaseReservedStockForOrderItem(
    tx: Prisma.TransactionClient,
    params: {
      businessId: string;
      orderId: string;
      orderItemId: string;
      currentOrderQty: number;
      releaseOrderQty: number;
      reason: string;
      performedBy: string;
    },
  ) {
    const reservations = await tx.inventoryReservation.findMany({
      where: {
        businessId: params.businessId,
        orderId: params.orderId,
        orderItemId: params.orderItemId,
        status: InventoryReservationStatus.Reserved,
      },
      include: {
        inventoryItem: true,
      },
    });

    if (reservations.length === 0) return;

    const releaseRatio =
      params.releaseOrderQty >= params.currentOrderQty
        ? 1
        : params.releaseOrderQty / params.currentOrderQty;

    for (const reservation of reservations) {
      const reservedQty = Number(reservation.quantity);
      const releaseQty = this.roundStock(reservedQty * releaseRatio);

      if (releaseQty <= 0) continue;

      const beforeStock = Number(reservation.inventoryItem.currentStock);
      const afterStock = this.roundStock(beforeStock + releaseQty);
      const remainingReservedQty = this.roundStock(reservedQty - releaseQty);

      await tx.inventoryItem.update({
        where: {
          id: reservation.inventoryItemId,
        },
        data: {
          currentStock: this.stockDecimal(afterStock),
          lastMovementAt: new Date(),
        },
      });

      await tx.inventoryStockMovement.create({
        data: {
          businessId: params.businessId,
          itemId: reservation.inventoryItemId,
          supplierId: reservation.inventoryItem.supplierId,
          actionType: InventoryStockActionType.Release,
          quantity: this.stockDecimal(releaseQty),
          unit: reservation.unit,
          beforeStock: this.stockDecimal(beforeStock),
          afterStock: this.stockDecimal(afterStock),
          reason: 'POS reservation released',
          note: params.reason,
          performedBy: params.performedBy,
        },
      });

      if (remainingReservedQty <= 0.0001) {
        await tx.inventoryReservation.update({
          where: {
            id: reservation.id,
          },
          data: {
            status: InventoryReservationStatus.Released,
            releasedAt: new Date(),
            reason: params.reason,
            quantity: this.stockDecimal(0),
          },
        });
      } else {
        await tx.inventoryReservation.update({
          where: {
            id: reservation.id,
          },
          data: {
            quantity: this.stockDecimal(remainingReservedQty),
            reason: params.reason,
          },
        });
      }
    }
  }

  private async recalculateOrderTotals(orderId: string) {
    const items = await this.prisma.posOrderItem.findMany({
      where: {
        orderId,
        status: {
          notIn: ['Voided', 'Cancelled'],
        },
      },
      select: {
        qty: true,
        rate: true,
      },
    });

    const existingOrder = await this.prisma.posOrder.findUnique({
      where: {
        id: orderId,
      },
    });

    if (!existingOrder) {
      throw new NotFoundException('Order was not found.');
    }

    if (items.length === 0) {
      const closedAt = new Date();

      const order = await this.prisma.posOrder.update({
        where: {
          id: orderId,
        },
        data: {
          status: 'Cancelled',
          subtotal: toDecimal(0),
          taxableAmount: toDecimal(0),
          vatAmount: toDecimal(0),
          grandTotal: toDecimal(0),
          cancelReason: 'No active items remaining.',
          cancelledAt: closedAt,
          closedById: 'system',
          closedByName: 'System',
        },
        include: this.includeOrderDetails(),
      });

      if (order.tableId) {
        await this.prisma.restaurantTable.update({
          where: {
            id: order.tableId,
          },
          data: {
            status: 'Free',
            activeOrderId: null,
            activeOrderNumber: null,
            currentAmount: null,
            currentGuests: null,
            lastOrderAt: null,
          },
        });
      }

      return order;
    }

    const subtotal = roundMoney(
      items.reduce(
        (sum, item) => sum + toNumber(item.qty) * toNumber(item.rate),
        0,
      ),
    );

    const taxableAmount = roundMoney(subtotal / 1.13);
    const vatAmount = roundMoney(subtotal - taxableAmount);
    const grandTotal = roundMoney(subtotal);

    const order = await this.prisma.posOrder.update({
      where: {
        id: orderId,
      },
      data: {
        subtotal: toDecimal(subtotal),
        taxableAmount: toDecimal(taxableAmount),
        vatAmount: toDecimal(vatAmount),
        grandTotal: toDecimal(grandTotal),
      },
      include: this.includeOrderDetails(),
    });

    if (order.tableId && order.status !== 'Draft') {
      await this.prisma.restaurantTable.update({
        where: {
          id: order.tableId,
        },
        data: {
          currentAmount: toDecimal(grandTotal),
          status: 'Occupied',
          activeOrderId: order.id,
          activeOrderNumber: order.orderNumber,
          lastOrderAt: new Date(),
        },
      });
    }

    return order;
  }

  async getActiveOrders() {
    const { businessId, branchId } = await this.getDemoContext();

    return this.prisma.posOrder.findMany({
      where: {
        businessId,
        branchId,
        status: {
          in: [...ACTIVE_ORDER_STATUSES],
        },
      },
      include: this.includeOrderDetails(),
      orderBy: {
        openedAt: 'desc',
      },
    });
  }
  async getOrderHistory() {
    const { businessId, branchId } = await this.getDemoContext();

    return this.prisma.posOrder.findMany({
      where: {
        businessId,
        branchId,
        status: {
          in: ['Completed', 'Cancelled'],
        },
      },
      include: this.includeOrderDetails(),
      orderBy: [
        {
          finalizedAt: 'desc',
        },
        {
          cancelledAt: 'desc',
        },
        {
          openedAt: 'desc',
        },
      ],
      take: 200,
    });
  }

  async getOrderById(orderId: string) {
    const { businessId, branchId } = await this.getDemoContext();

    const order = await this.prisma.posOrder.findFirst({
      where: {
        id: orderId,
        businessId,
        branchId,
      },
      include: this.includeOrderDetails(),
    });

    if (!order) {
      throw new NotFoundException('Order was not found.');
    }

    return order;
  }

  async getKotTickets() {
    const { businessId, branchId } = await this.getDemoContext();

    return this.prisma.kotTicket.findMany({
      where: {
        businessId,
        branchId,
      },
      include: {
        items: true,
        order: {
          select: {
            id: true,
            orderNumber: true,
            status: true,
            grandTotal: true,
            tableId: true,
            tableName: true,
            areaName: true,
            openedAt: true,
            lastKotAt: true,
            finalizedAt: true,
            cancelledAt: true,
          },
        },
      },
      orderBy: {
        sentAt: 'desc',
      },
      take: 200,
    });
  }
  async getActiveOrderByTable(tableId: string) {
    const { businessId, branchId } = await this.getDemoContext();

    return this.prisma.posOrder.findFirst({
      where: {
        businessId,
        branchId,
        tableId,
        status: {
          in: ['KotSent', 'InProgress'],
        },
      },
      include: this.includeOrderDetails(),
      orderBy: {
        openedAt: 'desc',
      },
    });
  }

  async createOrGetTableOrder(tableId: string) {
    const context = await this.getDemoContext();

    const table = await this.prisma.restaurantTable.findFirst({
      where: {
        id: tableId,
        businessId: context.businessId,
        branchId: context.branchId,
        isDeleted: false,
        isActive: true,
        area: {
          isDeleted: false,
          isActive: true,
        },
      },
      include: {
        area: true,
      },
    });

    if (!table) {
      throw new NotFoundException('Table was not found.');
    }

    if (table.activeOrderId) {
      const tableLinkedOrder = await this.prisma.posOrder.findFirst({
        where: {
          id: table.activeOrderId,
          businessId: context.businessId,
          branchId: context.branchId,
          tableId: table.id,
          status: {
            in: [...ACTIVE_ORDER_STATUSES],
          },
        },
        include: this.includeOrderDetails(),
      });

      if (tableLinkedOrder) {
        return tableLinkedOrder;
      }
    }

    const existingOrder = await this.prisma.posOrder.findFirst({
      where: {
        businessId: context.businessId,
        branchId: context.branchId,
        tableId,
        status: {
          in: [...ACTIVE_ORDER_STATUSES],
        },
      },
      include: this.includeOrderDetails(),
      orderBy: {
        openedAt: 'desc',
      },
    });

    if (existingOrder) {
      return existingOrder;
    }

    const orderNumber = `ORD-${String(Date.now()).slice(-6)}`;

    return this.prisma.$transaction(async (tx) => {
      const activeOrderInsideTransaction = await tx.posOrder.findFirst({
        where: {
          businessId: context.businessId,
          branchId: context.branchId,
          tableId: table.id,
          status: {
            in: [...ACTIVE_ORDER_STATUSES],
          },
        },
        include: this.includeOrderDetails(),
        orderBy: {
          openedAt: 'desc',
        },
      });

      if (activeOrderInsideTransaction) {
        return activeOrderInsideTransaction;
      }

      const order = await tx.posOrder.create({
        data: {
          businessId: table.businessId,
          branchId: table.branchId,
          terminalId: context.terminalId,
          tableId: table.id,
          tableName: table.name,
          areaId: table.areaId,
          areaName: table.area.name,
          orderNumber,
          status: 'Draft',
          guestCount: table.currentGuests,
          openedById: context.userId,
          openedByName: context.userName,
          events: {
            create: {
              businessId: table.businessId,
              branchId: table.branchId,
              eventType: 'Created',
              message: `Order ${orderNumber} created for ${table.name}.`,
              performedById: context.userId,
              performedByName: context.userName,
            },
          },
        },
        include: this.includeOrderDetails(),
      });

      return order;
    });
  }

  async addItem(orderId: string, payload: AddOrderItemDto) {
    const context = await this.getDemoContext();

    if (!payload.name?.trim()) {
      throw new BadRequestException('Item name is required.');
    }

    if (!payload.qty || payload.qty <= 0) {
      throw new BadRequestException('Item quantity must be greater than zero.');
    }

    if (!payload.rate || payload.rate <= 0) {
      throw new BadRequestException('Item rate must be greater than zero.');
    }

    const order = await this.prisma.posOrder.findFirst({
      where: {
        id: orderId,
        businessId: context.businessId,
        branchId: context.branchId,
        status: {
          in: ['Draft', 'KotSent', 'InProgress'],
        },
      },
    });

    if (!order) {
      throw new NotFoundException('Active order was not found.');
    }

    const grossAmount = roundMoney(payload.qty * payload.rate);

    await this.prisma.posOrderItem.create({
      data: {
        orderId: order.id,
        businessId: order.businessId,
        branchId: order.branchId,
        menuItemId: payload.menuItemId,
        name: payload.name.trim(),
        category: payload.category,
        section: payload.section,
        typeName: payload.typeName,
        kotDestination: payload.kotDestination || 'Kitchen',
        qty: toDecimal(payload.qty),
        rate: toDecimal(payload.rate),
        grossAmount: toDecimal(grossAmount),
        netAmount: toDecimal(grossAmount),
        status: 'Draft',
        note: payload.note?.trim() || undefined,
      },
    });

    await this.prisma.orderEvent.create({
      data: {
        businessId: order.businessId,
        branchId: order.branchId,
        orderId: order.id,
        eventType: 'ItemAdded',
        message: `${payload.name.trim()} x${payload.qty} added.`,
        performedById: context.userId,
        performedByName: context.userName,
      },
    });

    return this.recalculateOrderTotals(order.id);
  }

  async updateItemQuantity(orderId: string, itemId: string, qty?: number) {
    const context = await this.getDemoContext();

    if (qty === undefined || qty < 0) {
      throw new BadRequestException('Valid quantity is required.');
    }

    const order = await this.prisma.posOrder.findFirst({
      where: {
        id: orderId,
        businessId: context.businessId,
        branchId: context.branchId,
        status: {
          in: ['Draft', 'KotSent', 'InProgress'],
        },
      },
    });

    if (!order) {
      throw new NotFoundException('Active order was not found.');
    }

    const item = await this.prisma.posOrderItem.findFirst({
      where: {
        id: itemId,
        orderId,
        status: 'Draft',
      },
    });

    if (!item) {
      throw new NotFoundException('Draft order item was not found.');
    }

    if (qty === 0) {
      await this.prisma.posOrderItem.delete({
        where: {
          id: item.id,
        },
      });

      await this.prisma.orderEvent.create({
        data: {
          businessId: order.businessId,
          branchId: order.branchId,
          orderId: order.id,
          eventType: 'ItemRemoved',
          message: `${item.name} removed from order.`,
          performedById: context.userId,
          performedByName: context.userName,
        },
      });

      return this.recalculateOrderTotals(order.id);
    }

    const grossAmount = roundMoney(qty * toNumber(item.rate));

    await this.prisma.posOrderItem.update({
      where: {
        id: item.id,
      },
      data: {
        qty: toDecimal(qty),
        grossAmount: toDecimal(grossAmount),
        netAmount: toDecimal(grossAmount),
      },
    });

    await this.prisma.orderEvent.create({
      data: {
        businessId: order.businessId,
        branchId: order.branchId,
        orderId: order.id,
        eventType: 'ItemUpdated',
        message: `${item.name} quantity updated to ${qty}.`,
        performedById: context.userId,
        performedByName: context.userName,
      },
    });

    return this.recalculateOrderTotals(order.id);
  }

  async voidOrderItem(
    orderId: string,
    itemId: string,
    payload: VoidOrderItemDto,
  ) {
    const context = await this.getDemoContext();
    const reason = payload.reason?.trim();

    if (!reason) {
      throw new BadRequestException('Void reason is required.');
    }

    const order = await this.prisma.posOrder.findFirst({
      where: {
        id: orderId,
        businessId: context.businessId,
        branchId: context.branchId,
        status: {
          in: [...ACTIVE_ORDER_STATUSES],
        },
      },
    });

    if (!order) {
      throw new NotFoundException('Active order was not found.');
    }

    const item = await this.prisma.posOrderItem.findFirst({
      where: {
        id: itemId,
        orderId,
        status: {
          notIn: ['Voided', 'Cancelled'],
        },
      },
    });

    if (!item) {
      throw new NotFoundException('Active order item was not found.');
    }

    const currentQty = toNumber(item.qty);
    const requestedVoidQty = payload.quantity ?? currentQty;
    const voidQty = Math.min(requestedVoidQty, currentQty);

    if (voidQty <= 0) {
      throw new BadRequestException('Void quantity must be greater than zero.');
    }

    const isFullVoid = voidQty >= currentQty;
    const voidedAt = new Date();
    const voidedById = payload.voidedById || context.userId;
    const voidedByName = payload.voidedByName || context.userName;
    const note = payload.note?.trim();
    const voidReason = note ? `${reason} — ${note}` : reason;
    const cancelledTickets: Array<{
      ticketId: string;
      kotNumber: string;
      destination: string;
    }> = [];

    await this.prisma.$transaction(async (tx) => {
      if (isFullVoid) {
        await tx.posOrderItem.update({
          where: {
            id: item.id,
          },
          data: {
            status: 'Voided',
            voidReason,
            voidedById,
            voidedAt,
          },
        });
      } else {
        const remainingQty = roundMoney(currentQty - voidQty);
        const remainingGrossAmount = roundMoney(
          remainingQty * toNumber(item.rate),
        );

        await tx.posOrderItem.update({
          where: {
            id: item.id,
          },
          data: {
            qty: toDecimal(remainingQty),
            grossAmount: toDecimal(remainingGrossAmount),
            netAmount: toDecimal(remainingGrossAmount),
            voidReason,
            voidedById,
            voidedAt,
          },
        });

        await tx.kotTicketItem.updateMany({
          where: {
            orderItemId: item.id,
          },
          data: {
            qty: toDecimal(remainingQty),
          },
        });
      }

      await this.releaseReservedStockForOrderItem(tx, {
        businessId: order.businessId,
        orderId: order.id,
        orderItemId: item.id,
        currentOrderQty: currentQty,
        releaseOrderQty: voidQty,
        reason: voidReason,
        performedBy: voidedByName,
      });

      if (isFullVoid) {
        const affectedTicketLinks = await tx.kotTicketItem.findMany({
          where: {
            orderItemId: item.id,
          },
          select: {
            ticketId: true,
          },
        });

        const affectedTicketIds = Array.from(
          new Set(affectedTicketLinks.map((link) => link.ticketId)),
        );

        for (const ticketId of affectedTicketIds) {
          const ticket = await tx.kotTicket.findUnique({
            where: {
              id: ticketId,
            },
            include: {
              items: {
                include: {
                  orderItem: true,
                },
              },
            },
          });

          if (!ticket || ticket.status === 'Cancelled') {
            continue;
          }

          const hasActiveItems = ticket.items.some(
            (ticketItem) =>
              !['Voided', 'Cancelled'].includes(ticketItem.orderItem.status),
          );

          if (!hasActiveItems) {
            await tx.kotTicket.update({
              where: {
                id: ticket.id,
              },
              data: {
                status: 'Cancelled',
                cancelledAt: voidedAt,
                cancelReason: voidReason,
              },
            });

            cancelledTickets.push({
              ticketId: ticket.id,
              kotNumber: ticket.kotNumber,
              destination: ticket.destination,
            });
          }
        }
      }

      await tx.orderEvent.create({
        data: {
          businessId: order.businessId,
          branchId: order.branchId,
          orderId: order.id,
          eventType: 'ItemRemoved',
          message: isFullVoid
            ? `${item.name} voided. Reason: ${reason}.`
            : `${item.name} x${voidQty} voided. Reason: ${reason}.`,
          performedById: voidedById,
          performedByName: voidedByName,
          performedAt: voidedAt,
          metadata: {
            itemId: item.id,
            itemName: item.name,
            previousQty: currentQty,
            voidQty,
            remainingQty: Math.max(currentQty - voidQty, 0),
            reason,
            note,
            cancelledTickets,
          },
        },
      });

      if (cancelledTickets.length > 0) {
        await tx.orderEvent.create({
          data: {
            businessId: order.businessId,
            branchId: order.branchId,
            orderId: order.id,
            eventType: 'ItemRemoved',
            message: `${cancelledTickets
              .map((ticket) => ticket.kotNumber)
              .join(', ')} cancelled because all linked items were voided.`,
            performedById: voidedById,
            performedByName: voidedByName,
            performedAt: voidedAt,
            metadata: {
              reason,
              note,
              cancelledTickets,
            },
          },
        });
      }
    });

    return this.recalculateOrderTotals(order.id);
  }

  async sendKot(orderId: string, payload: SendKotDto) {
    const context = await this.getDemoContext();

    const order = await this.prisma.posOrder.findFirst({
      where: {
        id: orderId,
        businessId: context.businessId,
        branchId: context.branchId,
        status: {
          in: [...ACTIVE_ORDER_STATUSES],
        },
      },
      include: {
        items: true,
      },
    });

    if (!order) {
      throw new NotFoundException('Active order was not found.');
    }

    const selectedItems = order.items.filter(
      (item) => payload.itemIds.includes(item.id) && item.status === 'Draft',
    );

    if (selectedItems.length === 0) {
      throw new BadRequestException('No draft items selected for KOT/BOT.');
    }

    function normalizeDestination(value?: string | null) {
      const normalized = value?.trim().toLowerCase();

      if (normalized?.includes('bar')) return 'Bar';
      if (normalized?.includes('kitchen')) return 'Kitchen';

      return 'Kitchen';
    }

    function getTicketPrefix(destination: string) {
      return destination === 'Bar' ? 'BOT' : 'KOT';
    }

    const groupedItems = selectedItems.reduce<
      Record<string, typeof selectedItems>
    >((groups, item) => {
      const destination = normalizeDestination(item.kotDestination);

      if (!groups[destination]) {
        groups[destination] = [];
      }

      groups[destination].push(item);

      return groups;
    }, {});

    const sentAt = new Date();
    const performedById = payload.sentById || context.userId;
    const performedByName = payload.sentByName || context.userName;

    await this.prisma.$transaction(async (tx) => {
      await this.reserveStockForOrderItems(tx, {
        businessId: order.businessId,
        branchId: order.branchId,
        orderId: order.id,
        orderNumber: order.orderNumber,
        items: selectedItems.map((item) => ({
          id: item.id,
          menuItemId: item.menuItemId,
          name: item.name,
          qty: item.qty,
        })),
        performedBy: performedByName,
      });

      const createdTickets: Array<{
        kotNumber: string;
        destination: string;
        itemCount: number;
      }> = [];

      let ticketIndex = 0;

      for (const [destination, destinationItems] of Object.entries(
        groupedItems,
      )) {
        const prefix = getTicketPrefix(destination);
        const kotNumber = `${prefix}-${String(Date.now()).slice(-6)}${ticketIndex > 0 ? `-${ticketIndex + 1}` : ''}`;

        ticketIndex += 1;

        const ticket = await tx.kotTicket.create({
          data: {
            businessId: order.businessId,
            branchId: order.branchId,
            orderId: order.id,
            kotNumber,
            destination,
            tableId: order.tableId,
            tableName: order.tableName,
            areaName: order.areaName,
            sentById: performedById,
            sentByName: performedByName,
            sentAt,
            printCount: 1,
            lastPrintedAt: sentAt,
          },
        });

        for (const item of destinationItems) {
          await tx.kotTicketItem.create({
            data: {
              ticketId: ticket.id,
              orderItemId: item.id,
              businessId: order.businessId,
              branchId: order.branchId,
              name: item.name,
              qty: item.qty,
              note: item.note,
            },
          });

          await tx.posOrderItem.update({
            where: {
              id: item.id,
            },
            data: {
              status: 'Sent',
              sentAt,
            },
          });
        }

        createdTickets.push({
          kotNumber,
          destination,
          itemCount: destinationItems.length,
        });
      }

      await tx.posOrder.update({
        where: {
          id: order.id,
        },
        data: {
          status: order.status === 'Draft' ? 'KotSent' : order.status,
          lastKotAt: sentAt,
        },
      });
      if (order.tableId) {
        await tx.restaurantTable.update({
          where: {
            id: order.tableId,
          },
          data: {
            status: 'Occupied',
            activeOrderId: order.id,
            activeOrderNumber: order.orderNumber,
            currentAmount: order.grandTotal,
            currentGuests: order.guestCount,
            lastOrderAt: sentAt,
            reservationName: null,
            reservationPhone: null,
            reservationGuests: null,
            reservationTime: null,
            reservationNote: null,
          },
        });
      }

      await tx.orderEvent.create({
        data: {
          businessId: order.businessId,
          branchId: order.branchId,
          orderId: order.id,
          eventType: 'KotSent',
          message: createdTickets
            .map(
              (ticket) =>
                `${ticket.kotNumber} sent to ${ticket.destination} with ${ticket.itemCount} item(s).`,
            )
            .join(' '),
          performedById,
          performedByName,
          performedAt: sentAt,
          metadata: {
            tickets: createdTickets,
            selectedItemIds: selectedItems.map((item) => item.id),
          },
        },
      });
    });

    return this.prisma.posOrder.findUnique({
      where: {
        id: order.id,
      },
      include: this.includeOrderDetails(),
    });
  }
  private async getLiveKotTicket(ticketId: string) {
    const context = await this.getDemoContext();

    const ticket = await this.prisma.kotTicket.findFirst({
      where: {
        id: ticketId,
        businessId: context.businessId,
        branchId: context.branchId,
      },
      include: {
        items: {
          include: {
            orderItem: true,
          },
        },
        order: true,
      },
    });

    if (!ticket) {
      throw new NotFoundException('KOT/BOT ticket was not found.');
    }

    if (!LIVE_KOT_PARENT_STATUSES.includes(ticket.order.status)) {
      throw new BadRequestException(
        'Only tickets from active orders can be updated.',
      );
    }

    return {
      context,
      ticket,
    };
  }

  async markKotTicketPreparing(
    ticketId: string,
    payload: { performedById?: string; performedByName?: string } = {},
  ) {
    const { context, ticket } = await this.getLiveKotTicket(ticketId);

    if (ticket.status !== 'Sent') {
      throw new BadRequestException(
        'Only sent tickets can be marked as preparing.',
      );
    }

    const performedAt = new Date();
    const performedById = payload.performedById || context.userId;
    const performedByName = payload.performedByName || context.userName;

    await this.prisma.$transaction(async (tx) => {
      await tx.kotTicket.update({
        where: {
          id: ticket.id,
        },
        data: {
          status: 'Preparing',
          preparedAt: performedAt,
        },
      });

      await tx.posOrderItem.updateMany({
        where: {
          id: {
            in: ticket.items.map((item) => item.orderItemId),
          },
          status: 'Sent',
        },
        data: {
          status: 'Preparing',
          preparedAt: performedAt,
        },
      });

      if (ticket.order.status === 'KotSent') {
        await tx.posOrder.update({
          where: {
            id: ticket.orderId,
          },
          data: {
            status: 'InProgress',
          },
        });
      }

      await tx.orderEvent.create({
        data: {
          businessId: ticket.businessId,
          branchId: ticket.branchId,
          orderId: ticket.orderId,
          eventType: 'ItemUpdated',
          message: `${ticket.kotNumber} marked as preparing.`,
          performedById,
          performedByName,
          performedAt,
          metadata: {
            ticketId: ticket.id,
            kotNumber: ticket.kotNumber,
            destination: ticket.destination,
            previousStatus: ticket.status,
            nextStatus: 'Preparing',
          },
        },
      });
    });

    return this.prisma.kotTicket.findUnique({
      where: {
        id: ticket.id,
      },
      include: {
        items: true,
        order: {
          select: {
            id: true,
            orderNumber: true,
            status: true,
            grandTotal: true,
            tableId: true,
            tableName: true,
            areaName: true,
            openedAt: true,
            lastKotAt: true,
            finalizedAt: true,
            cancelledAt: true,
          },
        },
      },
    });
  }

  async markKotTicketReady(
    ticketId: string,
    payload: { performedById?: string; performedByName?: string } = {},
  ) {
    const { context, ticket } = await this.getLiveKotTicket(ticketId);

    if (!['Sent', 'Preparing'].includes(ticket.status)) {
      throw new BadRequestException(
        'Only sent or preparing tickets can be marked ready.',
      );
    }

    const performedAt = new Date();
    const performedById = payload.performedById || context.userId;
    const performedByName = payload.performedByName || context.userName;

    await this.prisma.$transaction(async (tx) => {
      await tx.kotTicket.update({
        where: {
          id: ticket.id,
        },
        data: {
          status: 'Ready',
          readyAt: performedAt,
          preparedAt: ticket.preparedAt ?? performedAt,
        },
      });

      await tx.posOrderItem.updateMany({
        where: {
          id: {
            in: ticket.items.map((item) => item.orderItemId),
          },
          status: {
            in: ['Sent', 'Preparing'],
          },
        },
        data: {
          status: 'Ready',
          preparedAt: performedAt,
        },
      });

      if (ticket.order.status === 'KotSent') {
        await tx.posOrder.update({
          where: {
            id: ticket.orderId,
          },
          data: {
            status: 'InProgress',
          },
        });
      }

      await tx.orderEvent.create({
        data: {
          businessId: ticket.businessId,
          branchId: ticket.branchId,
          orderId: ticket.orderId,
          eventType: 'ItemUpdated',
          message: `${ticket.kotNumber} marked ready.`,
          performedById,
          performedByName,
          performedAt,
          metadata: {
            ticketId: ticket.id,
            kotNumber: ticket.kotNumber,
            destination: ticket.destination,
            previousStatus: ticket.status,
            nextStatus: 'Ready',
          },
        },
      });
    });

    return this.prisma.kotTicket.findUnique({
      where: {
        id: ticket.id,
      },
      include: {
        items: true,
        order: {
          select: {
            id: true,
            orderNumber: true,
            status: true,
            grandTotal: true,
            tableId: true,
            tableName: true,
            areaName: true,
            openedAt: true,
            lastKotAt: true,
            finalizedAt: true,
            cancelledAt: true,
          },
        },
      },
    });
  }

  async markKotTicketServed(
    ticketId: string,
    payload: { performedById?: string; performedByName?: string } = {},
  ) {
    const { context, ticket } = await this.getLiveKotTicket(ticketId);

    if (ticket.status !== 'Ready') {
      throw new BadRequestException('Only ready tickets can be marked served.');
    }

    const performedAt = new Date();
    const performedById = payload.performedById || context.userId;
    const performedByName = payload.performedByName || context.userName;

    await this.prisma.$transaction(async (tx) => {
      await tx.kotTicket.update({
        where: {
          id: ticket.id,
        },
        data: {
          status: 'Served',
          servedAt: performedAt,
        },
      });

      await tx.posOrderItem.updateMany({
        where: {
          id: {
            in: ticket.items.map((item) => item.orderItemId),
          },
          status: 'Ready',
        },
        data: {
          status: 'Served',
          servedAt: performedAt,
        },
      });

      await tx.orderEvent.create({
        data: {
          businessId: ticket.businessId,
          branchId: ticket.branchId,
          orderId: ticket.orderId,
          eventType: 'ItemUpdated',
          message: `${ticket.kotNumber} marked served.`,
          performedById,
          performedByName,
          performedAt,
          metadata: {
            ticketId: ticket.id,
            kotNumber: ticket.kotNumber,
            destination: ticket.destination,
            previousStatus: ticket.status,
            nextStatus: 'Served',
          },
        },
      });
    });

    return this.prisma.kotTicket.findUnique({
      where: {
        id: ticket.id,
      },
      include: {
        items: true,
        order: {
          select: {
            id: true,
            orderNumber: true,
            status: true,
            grandTotal: true,
            tableId: true,
            tableName: true,
            areaName: true,
            openedAt: true,
            lastKotAt: true,
            finalizedAt: true,
            cancelledAt: true,
          },
        },
      },
    });
  }
}
