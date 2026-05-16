import { Injectable } from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';

const DEMO_BUSINESS_ID = 'softzeno-demo-business';

@Injectable()
export class PaymentsReadService {
  constructor(private readonly prisma: PrismaService) {}

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
      take: 100,
    });

    return {
      total: payments.length,
      payments,
    };
  }
}
