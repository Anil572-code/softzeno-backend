import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';

type PaymentSplitItem = {
  label: 'Cash' | 'QR' | 'Card' | 'Credit';
  value: number;
  percent: number;
};

function toNumber(value: Prisma.Decimal | number | null | undefined) {
  if (value === null || value === undefined) return 0;
  if (typeof value === 'number') return value;

  return Number(value);
}

function startOfLocalDay(date = new Date()) {
  const nextDate = new Date(date);
  nextDate.setHours(0, 0, 0, 0);

  return nextDate;
}

function endOfLocalDay(date = new Date()) {
  const nextDate = new Date(date);
  nextDate.setHours(23, 59, 59, 999);

  return nextDate;
}

function formatDayLabel(date: Date) {
  return date.toLocaleDateString('en-US', {
    weekday: 'short',
  });
}

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async getOverview() {
    const now = new Date();
    const todayStart = startOfLocalDay(now);
    const todayEnd = endOfLocalDay(now);

    const weekStart = startOfLocalDay(now);
    weekStart.setDate(weekStart.getDate() - 6);

    const [
      todayInvoiceAggregate,
      todayInvoiceCount,
      todayInvoices,
      weekInvoices,
      paymentReceipts,
      ledgerDebitAggregate,
      ledgerCreditAggregate,
      tableStatusGroups,
      lowStockItems,
      recentInvoices,
      topInvoiceItems,
    ] = await Promise.all([
      this.prisma.invoice.aggregate({
        where: {
          status: 'Finalized',
          finalizedAt: {
            gte: todayStart,
            lte: todayEnd,
          },
        },
        _sum: {
          grandTotal: true,
        },
      }),

      this.prisma.invoice.count({
        where: {
          status: 'Finalized',
          finalizedAt: {
            gte: todayStart,
            lte: todayEnd,
          },
        },
      }),

      this.prisma.invoice.findMany({
        where: {
          status: 'Finalized',
          finalizedAt: {
            gte: todayStart,
            lte: todayEnd,
          },
        },
        select: {
          id: true,
          invoiceNumber: true,
          customerName: true,
          tableName: true,
          grandTotal: true,
          paymentMode: true,
          paymentStatus: true,
          finalizedAt: true,
        },
        orderBy: {
          finalizedAt: 'desc',
        },
      }),

      this.prisma.invoice.findMany({
        where: {
          status: 'Finalized',
          finalizedAt: {
            gte: weekStart,
            lte: todayEnd,
          },
        },
        select: {
          finalizedAt: true,
          grandTotal: true,
        },
      }),

      this.prisma.paymentReceipt.findMany({
        where: {
          status: 'Completed',
          receivedAt: {
            gte: todayStart,
            lte: todayEnd,
          },
        },
        select: {
          method: true,
          amount: true,
        },
      }),

      this.prisma.ledgerEntry.aggregate({
        where: {
          isVoided: false,
        },
        _sum: {
          debit: true,
        },
      }),

      this.prisma.ledgerEntry.aggregate({
        where: {
          isVoided: false,
        },
        _sum: {
          credit: true,
        },
      }),

      this.prisma.restaurantTable.groupBy({
        by: ['status'],
        where: {
          isDeleted: false,
          isActive: true,
          area: {
            isDeleted: false,
            isActive: true,
          },
        },
        _count: {
          _all: true,
        },
      }),

      this.prisma.menuItem.findMany({
        where: {
          isTrashed: false,
          stock: {
            not: null,
          },
          lowStockLimit: {
            not: null,
          },
        },
        select: {
          id: true,
          name: true,
          stock: true,
          lowStockLimit: true,
        },
        orderBy: {
          stock: 'asc',
        },
      }),

      this.prisma.invoice.findMany({
        where: {
          status: 'Finalized',
        },
        select: {
          id: true,
          invoiceNumber: true,
          customerName: true,
          tableName: true,
          grandTotal: true,
          paymentMode: true,
          paymentStatus: true,
          finalizedAt: true,
        },
        orderBy: {
          finalizedAt: 'desc',
        },
        take: 6,
      }),

      this.prisma.invoiceItem.groupBy({
        by: ['name'],
        where: {
          invoice: {
            status: 'Finalized',
            finalizedAt: {
              gte: weekStart,
              lte: todayEnd,
            },
          },
          isVoided: false,
        },
        _sum: {
          qty: true,
          netAmount: true,
        },
        orderBy: {
          _sum: {
            netAmount: 'desc',
          },
        },
        take: 5,
      }),
    ]);

    const todaySales = toNumber(todayInvoiceAggregate._sum.grandTotal);
    const averageOrder =
      todayInvoiceCount > 0 ? Math.round(todaySales / todayInvoiceCount) : 0;

    const ledgerDebit = toNumber(ledgerDebitAggregate._sum.debit);
    const ledgerCredit = toNumber(ledgerCreditAggregate._sum.credit);
    const outstandingCredit = Math.max(ledgerDebit - ledgerCredit, 0);

    const weeklyRevenue = Array.from({ length: 7 }, (_, index) => {
      const date = startOfLocalDay(weekStart);
      date.setDate(weekStart.getDate() + index);

      const dayStart = startOfLocalDay(date);
      const dayEnd = endOfLocalDay(date);

      const value = weekInvoices
        .filter((invoice) => {
          const finalizedAt = new Date(invoice.finalizedAt);

          return finalizedAt >= dayStart && finalizedAt <= dayEnd;
        })
        .reduce((sum, invoice) => sum + toNumber(invoice.grandTotal), 0);

      return {
        day: formatDayLabel(date),
        value,
      };
    });

    const paymentTotals: Record<PaymentSplitItem['label'], number> = {
      Cash: 0,
      QR: 0,
      Card: 0,
      Credit: 0,
    };

    for (const receipt of paymentReceipts) {
      if (receipt.method === 'Cash') {
        paymentTotals.Cash += toNumber(receipt.amount);
      } else if (receipt.method === 'QR') {
        paymentTotals.QR += toNumber(receipt.amount);
      } else if (receipt.method === 'Card') {
        paymentTotals.Card += toNumber(receipt.amount);
      } else if (receipt.method === 'Credit') {
        paymentTotals.Credit += toNumber(receipt.amount);
      }
    }

    const paymentTotal = Object.values(paymentTotals).reduce(
      (sum, value) => sum + value,
      0,
    );

    const paymentSplit = Object.entries(paymentTotals).map(
      ([label, value]) => ({
        label: label as PaymentSplitItem['label'],
        value,
        percent:
          paymentTotal > 0 ? Math.round((value / paymentTotal) * 100) : 0,
      }),
    );

    const tableStatus = {
      free: 0,
      occupied: 0,
      reserved: 0,
    };

    for (const group of tableStatusGroups) {
      if (group.status === 'Free') tableStatus.free = group._count._all;
      if (group.status === 'Occupied') {
        tableStatus.occupied = group._count._all;
      }
      if (group.status === 'Reserved') {
        tableStatus.reserved = group._count._all;
      }
    }

    const filteredLowStockItems = lowStockItems.filter((item) => {
      if (item.stock === null || item.lowStockLimit === null) return false;

      return item.stock <= item.lowStockLimit;
    });

    return {
      generatedAt: now.toISOString(),
      primaryStats: {
        todaySales,
        orderCount: todayInvoiceCount,
        averageOrder,
        outstandingCredit,
      },
      todayAtGlance: {
        invoiceCount: todayInvoiceCount,
        paidInvoices: todayInvoices.filter(
          (invoice) => invoice.paymentStatus === 'Paid',
        ).length,
        creditInvoices: todayInvoices.filter((invoice) =>
          [
            'CreditOpen',
            'CreditPartiallyCleared',
            'CreditCleared',
            'PartiallyPaid',
          ].includes(invoice.paymentStatus),
        ).length,
        totalCollection: paymentTotal,
      },
      weeklyRevenue,
      paymentSplit,
      tableStatus,
      lowStock: {
        count: filteredLowStockItems.length,
        items: filteredLowStockItems.slice(0, 5).map((item) => ({
          id: item.id,
          name: item.name,
          stock: item.stock,
          lowStockLimit: item.lowStockLimit,
        })),
      },
      recentInvoices: recentInvoices.map((invoice) => ({
        id: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
        customerName: invoice.customerName,
        tableName: invoice.tableName,
        grandTotal: toNumber(invoice.grandTotal),
        paymentMode: invoice.paymentMode,
        paymentStatus: invoice.paymentStatus,
        finalizedAt: invoice.finalizedAt.toISOString(),
      })),
      topProducts: topInvoiceItems.map((item) => ({
        name: item.name,
        qty: toNumber(item._sum.qty),
        revenue: toNumber(item._sum.netAmount),
      })),
    };
  }
}
