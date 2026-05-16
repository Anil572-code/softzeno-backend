import {
  BadRequestException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class DevService {
  constructor(private readonly prisma: PrismaService) {}

  private assertResetAllowed() {
    const isProduction = process.env.NODE_ENV === 'production';
    const devResetEnabled = process.env.ENABLE_DEV_RESET === 'true';

    if (isProduction && !devResetEnabled) {
      throw new ForbiddenException(
        'Backend demo reset is disabled in production.',
      );
    }
  }
  async closeStuckOrders(confirmation?: string, orderIds?: string[]) {
    this.assertResetAllowed();

    if (confirmation !== 'CLOSE STUCK ORDERS') {
      throw new BadRequestException(
        'Type CLOSE STUCK ORDERS to confirm stuck order cleanup.',
      );
    }

    if (!Array.isArray(orderIds) || orderIds.length === 0) {
      throw new BadRequestException('At least one order ID is required.');
    }

    const result = await this.prisma.$transaction(async (tx) => {
      const stuckOrders = await tx.posOrder.findMany({
        where: {
          id: {
            in: orderIds,
          },
          status: {
            in: ['Draft', 'KotSent', 'InProgress'],
          },
        },
        select: {
          id: true,
          businessId: true,
          branchId: true,
          orderNumber: true,
          tableId: true,
          tableName: true,
          status: true,
        },
      });

      const stuckOrderIds = stuckOrders.map((order) => order.id);
      const stuckTableIds = stuckOrders
        .map((order) => order.tableId)
        .filter((tableId): tableId is string => Boolean(tableId));

      if (stuckOrderIds.length > 0) {
        await tx.posOrder.updateMany({
          where: {
            id: {
              in: stuckOrderIds,
            },
          },
          data: {
            status: 'Cancelled',
            cancelReason: 'Closed by dev stuck-order cleanup.',
            cancelledAt: new Date(),
            closedById: 'dev-cleanup',
            closedByName: 'Dev Cleanup',
          },
        });

        for (const order of stuckOrders) {
          await tx.orderEvent.create({
            data: {
              businessId: order.businessId,
              branchId: order.branchId,
              orderId: order.id,
              eventType: 'Created',
              message: `Order ${order.orderNumber} closed by dev stuck-order cleanup.`,
              performedById: 'dev-cleanup',
              performedByName: 'Dev Cleanup',
              performedAt: new Date(),
              metadata: {
                previousStatus: order.status,
                reason: 'Closed by dev stuck-order cleanup.',
              },
            },
          });
        }
      }

      if (stuckTableIds.length > 0) {
        await tx.restaurantTable.updateMany({
          where: {
            id: {
              in: stuckTableIds,
            },
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

      return {
        requestedOrderIds: orderIds,
        closedOrders: stuckOrders.map((order) => ({
          id: order.id,
          orderNumber: order.orderNumber,
          tableId: order.tableId,
          tableName: order.tableName,
          previousStatus: order.status,
        })),
        freedTableIds: stuckTableIds,
      };
    });

    return {
      status: 'success',
      message:
        result.closedOrders.length > 0
          ? 'Selected stuck active orders were closed and their tables were freed.'
          : 'No matching active stuck orders were found.',
      closedOrdersCount: result.closedOrders.length,
      freedTablesCount: result.freedTableIds.length,
      ...result,
    };
  }
  async getResetStatus() {
    this.assertResetAllowed();

    const [
      businesses,
      branches,
      tableAreas,
      restaurantTables,
      invoices,
      paymentReceipts,
      ledgerAccounts,
      menuItems,
      posOrders,
      activePosOrders,
      orphanOccupiedTables,
    ] = await Promise.all([
      this.prisma.business.count(),
      this.prisma.branch.count(),
      this.prisma.tableArea.count(),
      this.prisma.restaurantTable.count(),
      this.prisma.invoice.count(),
      this.prisma.paymentReceipt.count(),
      this.prisma.ledgerAccount.count(),
      this.prisma.menuItem.count(),
      this.prisma.posOrder.count(),
      this.prisma.posOrder.count({
        where: {
          status: {
            in: ['Draft', 'KotSent', 'InProgress'],
          },
        },
      }),
      this.prisma.restaurantTable.count({
        where: {
          isDeleted: false,
          OR: [
            { status: 'Occupied' },
            { activeOrderId: { not: null } },
            { activeOrderNumber: { not: null } },
            { currentAmount: { not: null } },
          ],
        },
      }),
    ]);

    return {
      status: 'available',
      environment: process.env.NODE_ENV ?? 'development',
      resetEnabled: true,
      confirmationText: 'RESET BACKEND',
      orphanTableCleanupConfirmationText: 'CLEAR ORPHAN TABLES',
      counts: {
        businesses,
        branches,
        tableAreas,
        restaurantTables,
        invoices,
        paymentReceipts,
        ledgerAccounts,
        menuItems,
        posOrders,
        activePosOrders,
        occupiedOrActiveTableMarkers: orphanOccupiedTables,
      },
    };
  }

  async clearOrphanTableOccupancy(confirmation?: string) {
    this.assertResetAllowed();

    if (confirmation !== 'CLEAR ORPHAN TABLES') {
      throw new BadRequestException(
        'Type CLEAR ORPHAN TABLES to confirm orphan table cleanup.',
      );
    }

    const result = await this.prisma.$transaction(async (tx) => {
      const activeOrders = await tx.posOrder.findMany({
        where: {
          status: {
            in: ['Draft', 'KotSent', 'InProgress'],
          },
          tableId: {
            not: null,
          },
        },
        select: {
          id: true,
          orderNumber: true,
          tableId: true,
          tableName: true,
          status: true,
        },
      });

      const activeOrderIds = new Set(activeOrders.map((order) => order.id));
      const activeTableIds = new Set(
        activeOrders
          .map((order) => order.tableId)
          .filter((tableId): tableId is string => Boolean(tableId)),
      );

      const occupiedTables = await tx.restaurantTable.findMany({
        where: {
          isDeleted: false,
          OR: [
            { status: 'Occupied' },
            { activeOrderId: { not: null } },
            { activeOrderNumber: { not: null } },
            { currentAmount: { not: null } },
          ],
        },
        select: {
          id: true,
          name: true,
          status: true,
          activeOrderId: true,
          activeOrderNumber: true,
          currentAmount: true,
        },
        orderBy: {
          name: 'asc',
        },
      });

      const orphanTables = occupiedTables.filter((table) => {
        if (activeTableIds.has(table.id)) return false;
        if (!table.activeOrderId) return true;

        return !activeOrderIds.has(table.activeOrderId);
      });

      const orphanTableIds = orphanTables.map((table) => table.id);

      if (orphanTableIds.length > 0) {
        await tx.restaurantTable.updateMany({
          where: {
            id: {
              in: orphanTableIds,
            },
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

      return {
        activeOrders: activeOrders.map((order) => ({
          id: order.id,
          orderNumber: order.orderNumber,
          tableId: order.tableId,
          tableName: order.tableName,
          status: order.status,
        })),
        scannedOccupiedTables: occupiedTables.map((table) => ({
          id: table.id,
          name: table.name,
          status: table.status,
          activeOrderId: table.activeOrderId,
          activeOrderNumber: table.activeOrderNumber,
          currentAmount: table.currentAmount,
        })),
        clearedTables: orphanTables.map((table) => ({
          id: table.id,
          name: table.name,
          previousStatus: table.status,
          previousActiveOrderId: table.activeOrderId,
          previousActiveOrderNumber: table.activeOrderNumber,
          previousCurrentAmount: table.currentAmount,
        })),
      };
    });

    return {
      status: 'success',
      message:
        result.clearedTables.length > 0
          ? 'Orphan table occupancy was cleared.'
          : 'No orphan occupied tables were found.',
      activeOrdersCount: result.activeOrders.length,
      scannedOccupiedTablesCount: result.scannedOccupiedTables.length,
      clearedTablesCount: result.clearedTables.length,
      ...result,
    };
  }

  async resetDemoData(confirmation?: string) {
    this.assertResetAllowed();

    if (confirmation !== 'RESET BACKEND') {
      throw new BadRequestException('Type RESET BACKEND to confirm reset.');
    }

    const business = await this.prisma.business.findFirst({
      orderBy: {
        createdAt: 'asc',
      },
    });

    if (!business) {
      throw new BadRequestException(
        'No business exists. Cannot recreate demo table area.',
      );
    }

    const branch = await this.prisma.branch.findFirst({
      where: {
        businessId: business.id,
      },
      orderBy: {
        createdAt: 'asc',
      },
    });

    const branchId = branch?.id ?? null;

    const result = await this.prisma.$transaction(async (tx) => {
      const deleted = {
        kotTicketItems: await tx.kotTicketItem.deleteMany({}),
        kotTickets: await tx.kotTicket.deleteMany({}),
        orderEvents: await tx.orderEvent.deleteMany({}),
        posOrderItems: await tx.posOrderItem.deleteMany({}),
        posOrders: await tx.posOrder.deleteMany({}),
        ledgerAllocations: await tx.ledgerAllocation.deleteMany({}),
        ledgerEntries: await tx.ledgerEntry.deleteMany({}),
        ledgerAccounts: await tx.ledgerAccount.deleteMany({}),

        paymentParts: await tx.paymentPart.deleteMany({}),
        paymentReceipts: await tx.paymentReceipt.deleteMany({}),

        invoiceItems: await tx.invoiceItem.deleteMany({}),
        invoices: await tx.invoice.deleteMany({}),
        cbmsSyncLogs: await tx.cbmsSyncLog.deleteMany({}),

        menuItems: await tx.menuItem.deleteMany({}),
        menuTypes: await tx.menuType.deleteMany({}),
        menuCategories: await tx.menuCategory.deleteMany({}),
        menuSections: await tx.menuSection.deleteMany({}),

        floorTexts: await tx.floorText.deleteMany({}),
        floorLines: await tx.floorLine.deleteMany({}),
        floorZones: await tx.floorZone.deleteMany({}),
        floorBlocks: await tx.floorBlock.deleteMany({}),
        floorLayouts: await tx.floorLayout.deleteMany({}),

        restaurantTables: await tx.restaurantTable.deleteMany({}),
        tableAreas: await tx.tableArea.deleteMany({}),

        auditTrails: await tx.auditTrail.deleteMany({}),
      };

      await tx.invoiceSequence.updateMany({
        data: {
          currentSequence: 0,
          lastInvoiceNumber: null,
          locked: false,
        },
      });

      const mainHall = await tx.tableArea.create({
        data: {
          businessId: business.id,
          branchId,
          name: 'Main Hall',
          description: 'Default restaurant floor area',
          sortOrder: 1,
          isActive: true,
          isDeleted: false,
        },
      });

      const floorLayout = await tx.floorLayout.create({
        data: {
          businessId: business.id,
          branchId,
          areaId: mainHall.id,
          canvasType: 'standard',
          width: 1200,
          height: 720,
        },
      });

      return {
        deleted,
        recreated: {
          businessId: business.id,
          branchId,
          mainHallId: mainHall.id,
          floorLayoutId: floorLayout.id,
        },
      };
    });

    return {
      status: 'success',
      message: 'Backend demo data was reset successfully.',
      ...result,
    };
  }
}
