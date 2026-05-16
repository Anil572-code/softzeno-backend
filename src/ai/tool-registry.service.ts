import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

type AttentionItem = {
  type: 'sales' | 'ledger' | 'inventory' | 'orders' | 'menu' | 'system';
  severity: 'low' | 'medium' | 'high';
  title: string;
  description: string;
  actionHint: string;
};

type BusinessSnapshot = {
  generatedAt: string;
  mode: 'read_only';
  totals: {
    openCreditAccounts: number;
    unpaidLedgerBalance: number;
    runningOrders: number;
    lowStockItems: number;
    unavailableMenuItems: number;
    todayInvoices: number;
    todayRevenue: number;
  };
  attention: AttentionItem[];
  raw: {
    creditAccounts: unknown[];
    runningOrders: unknown[];
    lowStockItems: unknown[];
    unavailableMenuItems: unknown[];
    todayInvoices: unknown[];
  };
};

@Injectable()
export class ToolRegistryService {
  constructor(private readonly prisma: PrismaService) {}

  async getBusinessSnapshot(): Promise<BusinessSnapshot> {
    const [
      creditAccounts,
      runningOrders,
      lowStockItems,
      unavailableMenuItems,
      todayInvoices,
    ] = await Promise.all([
      this.getCreditAccounts(),
      this.getRunningOrders(),
      this.getLowStockItems(),
      this.getUnavailableMenuItems(),
      this.getTodayInvoices(),
    ]);

    const unpaidLedgerBalance = creditAccounts.reduce((sum, item) => {
      const value =
        Number(item.balance) ||
        Number(item.remainingBalance) ||
        Number(item.dueAmount) ||
        Number(item.totalDue) ||
        0;

      return sum + value;
    }, 0);

    const todayRevenue = todayInvoices.reduce((sum, item) => {
      const value =
        Number(item.grandTotal) ||
        Number(item.totalAmount) ||
        Number(item.total) ||
        Number(item.amount) ||
        0;

      return sum + value;
    }, 0);

    const attention: AttentionItem[] = [];

    if (creditAccounts.length > 0) {
      attention.push({
        type: 'ledger',
        severity: unpaidLedgerBalance > 10000 ? 'high' : 'medium',
        title: 'Open credit accounts need review',
        description: `${creditAccounts.length} account(s) appear to have unpaid credit balance.`,
        actionHint:
          'Review Ledger page before collecting or settling any credit amount.',
      });
    }

    if (runningOrders.length > 0) {
      attention.push({
        type: 'orders',
        severity: runningOrders.length > 10 ? 'high' : 'medium',
        title: 'Running orders are active',
        description: `${runningOrders.length} running order(s) need operational visibility.`,
        actionHint:
          'Check Orders/POS page and confirm whether KOT preparation or billing is pending.',
      });
    }

    if (lowStockItems.length > 0) {
      attention.push({
        type: 'inventory',
        severity: lowStockItems.length > 5 ? 'high' : 'medium',
        title: 'Low stock items found',
        description: `${lowStockItems.length} item(s) appear to be below stock threshold.`,
        actionHint:
          'Review Inventory before marking menu items unavailable or preparing purchase requests.',
      });
    }

    if (unavailableMenuItems.length > 0) {
      attention.push({
        type: 'menu',
        severity: 'low',
        title: 'Unavailable menu items',
        description: `${unavailableMenuItems.length} menu item(s) are currently unavailable.`,
        actionHint:
          'Check whether unavailable items are intentional or caused by stock shortage.',
      });
    }

    if (todayInvoices.length === 0) {
      attention.push({
        type: 'sales',
        severity: 'medium',
        title: 'No invoices found for today',
        description:
          'No invoice records were detected for today from the available backend models.',
        actionHint:
          'Confirm whether sales have started, invoice data exists, or model mapping needs adjustment.',
      });
    }

    if (attention.length === 0) {
      attention.push({
        type: 'system',
        severity: 'low',
        title: 'No urgent issue detected',
        description:
          'The available read-only business snapshot does not show obvious risk.',
        actionHint:
          'Continue monitoring sales, credit, inventory, and running orders.',
      });
    }

    return {
      generatedAt: new Date().toISOString(),
      mode: 'read_only',
      totals: {
        openCreditAccounts: creditAccounts.length,
        unpaidLedgerBalance,
        runningOrders: runningOrders.length,
        lowStockItems: lowStockItems.length,
        unavailableMenuItems: unavailableMenuItems.length,
        todayInvoices: todayInvoices.length,
        todayRevenue,
      },
      attention,
      raw: {
        creditAccounts: creditAccounts.slice(0, 20),
        runningOrders: runningOrders.slice(0, 20),
        lowStockItems: lowStockItems.slice(0, 20),
        unavailableMenuItems: unavailableMenuItems.slice(0, 20),
        todayInvoices: todayInvoices.slice(0, 20),
      },
    };
  }
  async getCompactBusinessSnapshot() {
    const snapshot = await this.getBusinessSnapshot();

    const runningOrders = Array.isArray(snapshot.raw.runningOrders)
      ? snapshot.raw.runningOrders
      : [];

    const todayInvoices = Array.isArray(snapshot.raw.todayInvoices)
      ? snapshot.raw.todayInvoices
      : [];

    const now = Date.now();

    const activeOrders = runningOrders.map((order: any) => {
      const openedAt = order.openedAt || order.createdAt || null;
      const openedMs = openedAt ? new Date(openedAt).getTime() : 0;
      const ageMinutes = openedMs
        ? Math.max(0, Math.round((now - openedMs) / 60000))
        : 0;

      return {
        orderNumber: order.orderNumber || 'Unknown',
        tableName: order.tableName || 'Unknown table',
        areaName: order.areaName || 'Unknown area',
        status: order.status || 'Unknown',
        grandTotal: Number(order.grandTotal || 0),
        openedAt,
        ageMinutes,
        kotSent: Boolean(order.lastKotAt),
      };
    });

    const staleDraftOrders = activeOrders.filter((order) => {
      return (
        String(order.status).toLowerCase() === 'draft' &&
        Number(order.grandTotal || 0) <= 0 &&
        order.ageMinutes >= 30
      );
    });

    const pendingCbmsInvoices = todayInvoices.filter((invoice: any) => {
      return String(invoice.cbmsStatus || '').toLowerCase() === 'pending';
    });

    const cashSales = todayInvoices.reduce((sum: number, invoice: any) => {
      const paymentMode = String(invoice.paymentMode || '').toLowerCase();

      if (paymentMode.includes('cash')) {
        return (
          sum +
          Number(
            invoice.grandTotal || invoice.totalAmount || invoice.total || 0,
          )
        );
      }

      return sum;
    }, 0);

    const creditSales = todayInvoices.reduce((sum: number, invoice: any) => {
      return sum + Number(invoice.creditAmount || 0);
    }, 0);

    const paidInvoices = todayInvoices.filter((invoice: any) => {
      return String(invoice.paymentStatus || '').toLowerCase() === 'paid';
    });

    const creditInvoices = todayInvoices.filter((invoice: any) => {
      return Number(invoice.creditAmount || 0) > 0;
    });

    return {
      generatedAt: snapshot.generatedAt,
      mode: snapshot.mode,
      totals: {
        ...snapshot.totals,
        draftOrders: activeOrders.filter((order) => {
          return String(order.status).toLowerCase() === 'draft';
        }).length,
        staleDraftOrders: staleDraftOrders.length,
        pendingCbmsInvoices: pendingCbmsInvoices.length,
        cashSales,
        creditSales,
        paidInvoices: paidInvoices.length,
        creditInvoices: creditInvoices.length,
      },
      attention: snapshot.attention,
      highlights: {
        activeOrders: activeOrders.slice(0, 8),
        staleDraftOrders: staleDraftOrders.slice(0, 8),
        pendingCbmsInvoices: pendingCbmsInvoices
          .slice(0, 8)
          .map((invoice: any) => ({
            invoiceNumber: invoice.invoiceNumber || 'Unknown',
            grandTotal: Number(
              invoice.grandTotal || invoice.totalAmount || invoice.total || 0,
            ),
            paymentMode: invoice.paymentMode || 'Unknown',
            paymentStatus: invoice.paymentStatus || 'Unknown',
            cbmsStatus: invoice.cbmsStatus || 'Unknown',
            finalizedAt: invoice.finalizedAt || invoice.createdAt || null,
          })),
      },
    };
  }

  private async getCreditAccounts(): Promise<any[]> {
    const prismaAny = this.prisma as any;

    try {
      if (prismaAny.ledgerAccount?.findMany) {
        return await prismaAny.ledgerAccount.findMany({
          where: {
            OR: [
              { balance: { gt: 0 } },
              { remainingBalance: { gt: 0 } },
              { dueAmount: { gt: 0 } },
              { totalDue: { gt: 0 } },
            ],
          },
          orderBy: { updatedAt: 'desc' },
          take: 50,
        });
      }

      if (prismaAny.customerLedger?.findMany) {
        return await prismaAny.customerLedger.findMany({
          orderBy: { updatedAt: 'desc' },
          take: 50,
        });
      }

      return [];
    } catch {
      return [];
    }
  }

  private async getRunningOrders(): Promise<any[]> {
    const prismaAny = this.prisma as any;

    const activeStatuses = new Set([
      'Draft',
      'DRAFT',
      'draft',
      'Running',
      'RUNNING',
      'running',
      'Placed',
      'PLACED',
      'placed',
      'KOT_SENT',
      'KotSent',
      'kot_sent',
      'Preparing',
      'PREPARING',
      'preparing',
      'Ready',
      'READY',
      'ready',
    ]);

    const closedStatuses = new Set([
      'Completed',
      'COMPLETED',
      'completed',
      'Cancelled',
      'CANCELLED',
      'cancelled',
      'Voided',
      'VOIDED',
      'voided',
      'Closed',
      'CLOSED',
      'closed',
    ]);

    const normalizeOrders = (orders: any[]) => {
      return orders
        .filter((order) => {
          const status = String(order.status || '');

          if (closedStatuses.has(status)) {
            return false;
          }

          if (activeStatuses.has(status)) {
            return true;
          }

          return !order.finalizedAt && !order.cancelledAt && !order.invoiceId;
        })
        .sort((a, b) => {
          const aTime = new Date(a.openedAt || a.createdAt || 0).getTime();
          const bTime = new Date(b.openedAt || b.createdAt || 0).getTime();

          return bTime - aTime;
        })
        .slice(0, 50);
    };

    try {
      if (prismaAny.posOrder?.findMany) {
        const orders = await prismaAny.posOrder.findMany({
          orderBy: { createdAt: 'desc' },
          take: 200,
        });

        return normalizeOrders(orders);
      }

      if (prismaAny.order?.findMany) {
        const orders = await prismaAny.order.findMany({
          orderBy: { createdAt: 'desc' },
          take: 200,
        });

        return normalizeOrders(orders);
      }

      return [];
    } catch {
      return [];
    }
  }

  private async getLowStockItems(): Promise<any[]> {
    const prismaAny = this.prisma as any;

    try {
      if (prismaAny.inventoryItem?.findMany) {
        return await prismaAny.inventoryItem.findMany({
          where: {
            OR: [
              { status: 'LOW_STOCK' },
              { status: 'Low Stock' },
              { status: 'low_stock' },
            ],
          },
          orderBy: { updatedAt: 'desc' },
          take: 50,
        });
      }

      if (prismaAny.ingredient?.findMany) {
        return await prismaAny.ingredient.findMany({
          orderBy: { updatedAt: 'desc' },
          take: 50,
        });
      }

      return [];
    } catch {
      return [];
    }
  }

  private async getUnavailableMenuItems(): Promise<any[]> {
    const prismaAny = this.prisma as any;

    try {
      if (prismaAny.menuItem?.findMany) {
        return await prismaAny.menuItem.findMany({
          where: {
            OR: [
              { status: 'UNAVAILABLE' },
              { status: 'Unavailable' },
              { available: false },
              { isAvailable: false },
            ],
          },
          orderBy: { updatedAt: 'desc' },
          take: 50,
        });
      }

      return [];
    } catch {
      return [];
    }
  }

  private getNepalBusinessDayRange() {
    const now = new Date();

    const nepalOffsetMinutes = 5 * 60 + 45;
    const utcMs = now.getTime() + now.getTimezoneOffset() * 60_000;
    const nepalNow = new Date(utcMs + nepalOffsetMinutes * 60_000);

    const nepalStart = new Date(nepalNow);
    nepalStart.setHours(0, 0, 0, 0);

    const nepalEnd = new Date(nepalNow);
    nepalEnd.setHours(23, 59, 59, 999);

    const startUtc = new Date(
      nepalStart.getTime() - nepalOffsetMinutes * 60_000,
    );
    const endUtc = new Date(nepalEnd.getTime() - nepalOffsetMinutes * 60_000);

    return {
      startUtc,
      endUtc,
    };
  }

  private async getTodayInvoices(): Promise<any[]> {
    const prismaAny = this.prisma as any;
    const { startUtc, endUtc } = this.getNepalBusinessDayRange();

    const whereByBusinessDay = {
      OR: [
        {
          finalizedAt: {
            gte: startUtc,
            lte: endUtc,
          },
        },
        {
          createdAt: {
            gte: startUtc,
            lte: endUtc,
          },
        },
      ],
    };

    try {
      if (prismaAny.taxInvoice?.findMany) {
        return await prismaAny.taxInvoice.findMany({
          where: whereByBusinessDay,
          orderBy: { createdAt: 'desc' },
          take: 100,
        });
      }

      if (prismaAny.invoice?.findMany) {
        return await prismaAny.invoice.findMany({
          where: whereByBusinessDay,
          orderBy: { createdAt: 'desc' },
          take: 100,
        });
      }

      if (prismaAny.invoiceRegister?.findMany) {
        return await prismaAny.invoiceRegister.findMany({
          where: whereByBusinessDay,
          orderBy: { createdAt: 'desc' },
          take: 100,
        });
      }

      return [];
    } catch {
      return [];
    }
  }
}
