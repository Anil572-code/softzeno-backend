import { Injectable } from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';

const DEMO_BUSINESS_ID = 'softzeno-demo-business';

@Injectable()
export class BillingReadService {
  constructor(private readonly prisma: PrismaService) {}

  async getInvoices() {
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
      take: 50,
    });

    return {
      total: invoices.length,
      invoices,
    };
  }

  async getInvoiceById(id: string) {
    return this.prisma.invoice.findUnique({
      where: {
        id,
      },
      include: {
        items: true,
      },
    });
  }

  async getPayments() {
    const payments = await this.prisma.paymentReceipt.findMany({
      where: {
        businessId: DEMO_BUSINESS_ID,
      },
      orderBy: {
        receivedAt: 'desc',
      },
      include: {
        parts: true,
      },
      take: 50,
    });

    return {
      total: payments.length,
      payments,
    };
  }

  async getLedgerEntries() {
    const entries = await this.prisma.ledgerEntry.findMany({
      where: {
        businessId: DEMO_BUSINESS_ID,
      },
      orderBy: {
        date: 'desc',
      },
      include: {
        account: true,
      },
      take: 50,
    });

    return {
      total: entries.length,
      entries,
    };
  }

  async getCbmsLogs() {
    const logs = await this.prisma.cbmsSyncLog.findMany({
      where: {
        businessId: DEMO_BUSINESS_ID,
      },
      orderBy: {
        attemptedAt: 'desc',
      },
      take: 50,
    });

    return {
      total: logs.length,
      logs,
    };
  }
}
