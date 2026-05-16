import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  CashSession,
  CashSessionStatus,
  PaymentMethod,
  PaymentReceipt,
  PaymentReceiptStatus,
  PaymentSource,
  Prisma,
} from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';
import { CloseCashSessionDto } from './dto/close-cash-session.dto';
import { OpenCashSessionDto } from './dto/open-cash-session.dto';

const DEMO_BUSINESS_ID = 'softzeno-demo-business';
const DEMO_BRANCH_CODE = 'BHR';
const DEMO_TERMINAL_CODE = 'POS-01';
const DEMO_ADMIN_USERNAME = '@admin';

type PaymentWithParts = PaymentReceipt & {
  parts: {
    id: string;
    method: PaymentMethod;
    amount: Prisma.Decimal;
    provider: string | null;
    referenceNumber: string | null;
    bankName: string | null;
    createdAt: Date;
    updatedAt: Date;
    paymentReceiptId: string;
  }[];
};

@Injectable()
export class CashSessionsService {
  constructor(private readonly prisma: PrismaService) {}

  private roundMoney(value: number) {
    return Math.round((value + Number.EPSILON) * 100) / 100;
  }

  private toDecimal(value: number) {
    return new Prisma.Decimal(this.roundMoney(value));
  }

  private getCashComponent(payment: PaymentWithParts) {
    if (payment.method === PaymentMethod.Cash) {
      return Number(payment.amount);
    }

    if (payment.method === PaymentMethod.Mixed) {
      return payment.parts
        .filter((part) => part.method === PaymentMethod.Cash)
        .reduce((sum, part) => sum + Number(part.amount), 0);
    }

    return 0;
  }

  private getCashDirection(payment: PaymentWithParts) {
    if (
      payment.status === PaymentReceiptStatus.Voided ||
      payment.status === PaymentReceiptStatus.Failed
    ) {
      return 'NoCashImpact' as const;
    }

    if (payment.status === PaymentReceiptStatus.Refunded) {
      return 'CashOut' as const;
    }

    if (payment.method === PaymentMethod.Credit) {
      return 'NoCashImpact' as const;
    }

    if (
      payment.source === PaymentSource.SupplierPayment ||
      payment.source === PaymentSource.StaffSettlement
    ) {
      return 'CashOut' as const;
    }

    return 'CashIn' as const;
  }

  private getCashIn(payment: PaymentWithParts) {
    if (this.getCashDirection(payment) !== 'CashIn') return 0;
    return this.getCashComponent(payment);
  }

  private getCashOut(payment: PaymentWithParts) {
    const cashComponent = this.getCashComponent(payment);

    if (cashComponent <= 0) return 0;

    if (payment.status === PaymentReceiptStatus.Refunded) {
      const refundedAmount = payment.refundedAmount
        ? Number(payment.refundedAmount)
        : Number(payment.amount);

      return Math.min(cashComponent, refundedAmount);
    }

    if (this.getCashDirection(payment) !== 'CashOut') return 0;

    return cashComponent;
  }

  private async getDemoContext(terminalCode = DEMO_TERMINAL_CODE) {
    const business = await this.prisma.business.findUnique({
      where: {
        id: DEMO_BUSINESS_ID,
      },
    });

    if (!business) {
      throw new NotFoundException('Demo business was not found.');
    }

    const branch = await this.prisma.branch.findFirst({
      where: {
        businessId: business.id,
        code: DEMO_BRANCH_CODE,
        isActive: true,
      },
    });

    if (!branch) {
      throw new NotFoundException('Demo branch was not found.');
    }

    const terminal =
      (await this.prisma.terminal.findFirst({
        where: {
          businessId: business.id,
          branchId: branch.id,
          code: terminalCode,
          isActive: true,
        },
      })) ??
      (await this.prisma.terminal.findFirst({
        where: {
          businessId: business.id,
          branchId: branch.id,
          isActive: true,
        },
        orderBy: {
          createdAt: 'asc',
        },
      }));

    if (!terminal) {
      throw new NotFoundException(`No active terminal was found.`);
    }
    const admin = await this.prisma.user.findFirst({
      where: {
        businessId: business.id,
        username: DEMO_ADMIN_USERNAME,
        isDeleted: false,
      },
    });

    return {
      business,
      branch,
      terminal,
      admin,
    };
  }

  private async buildSessionNumber(params: {
    businessId: string;
    branchId: string;
    branchCode: string;
    terminalId: string;
    terminalCode: string;
  }) {
    const now = new Date();
    const yyyy = String(now.getFullYear());
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    const dateKey = `${yyyy}${mm}${dd}`;

    const startOfDay = new Date(now);
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date(now);
    endOfDay.setHours(23, 59, 59, 999);

    const count = await this.prisma.cashSession.count({
      where: {
        businessId: params.businessId,
        branchId: params.branchId,
        terminalId: params.terminalId,
        openedAt: {
          gte: startOfDay,
          lte: endOfDay,
        },
      },
    });

    return `CS-${params.branchCode}-${params.terminalCode}-${dateKey}-${String(
      count + 1,
    ).padStart(4, '0')}`;
  }

  private async getSessionPayments(session: CashSession) {
    return this.prisma.paymentReceipt.findMany({
      where: {
        businessId: session.businessId,
        branchId: session.branchId,
        terminalId: session.terminalId,
        receivedAt: {
          gte: session.openedAt,
          ...(session.closedAt ? { lte: session.closedAt } : {}),
        },
        status: {
          in: [PaymentReceiptStatus.Completed, PaymentReceiptStatus.Refunded],
        },
        OR: [
          {
            method: PaymentMethod.Cash,
          },
          {
            method: PaymentMethod.Mixed,
          },
        ],
      },
      orderBy: {
        receivedAt: 'desc',
      },
      include: {
        parts: true,
      },
    });
  }

  private calculateCashTotals(payments: PaymentWithParts[]) {
    const cashIn = this.roundMoney(
      payments.reduce((sum, payment) => sum + this.getCashIn(payment), 0),
    );

    const cashOut = this.roundMoney(
      payments.reduce((sum, payment) => sum + this.getCashOut(payment), 0),
    );

    return {
      cashIn,
      cashOut,
    };
  }

  private serializeSession(
    session: CashSession,
    computed?: {
      cashIn: number;
      cashOut: number;
    },
  ) {
    const cashIn = computed?.cashIn ?? Number(session.cashIn);
    const cashOut = computed?.cashOut ?? Number(session.cashOut);
    const openingCash = Number(session.openingCash);
    const expectedCash = this.roundMoney(openingCash + cashIn - cashOut);
    const countedCash =
      session.countedCash === null ? null : Number(session.countedCash);
    const difference =
      session.difference === null ? null : Number(session.difference);

    return {
      id: session.id,
      sessionNumber: session.sessionNumber,
      businessId: session.businessId,
      branchId: session.branchId,
      terminalId: session.terminalId,
      openingCash,
      cashIn,
      cashOut,
      expectedCash,
      countedCash,
      difference,
      status: session.status,
      openedById: session.openedById,
      openedByName: session.openedByName,
      closedById: session.closedById,
      closedByName: session.closedByName,
      openedAt: session.openedAt,
      closedAt: session.closedAt,
      closeNote: session.closeNote,
      managerApprovalId: session.managerApprovalId,
      createdAt: session.createdAt,
      updatedAt: session.updatedAt,
    };
  }

  async getCurrentSession() {
    const { business, branch, terminal } = await this.getDemoContext();

    const session = await this.prisma.cashSession.findFirst({
      where: {
        businessId: business.id,
        branchId: branch.id,
        terminalId: terminal.id,
        status: CashSessionStatus.Open,
      },
      orderBy: {
        openedAt: 'desc',
      },
    });

    if (!session) {
      return {
        session: null,
        message: 'No open cash session.',
      };
    }

    const payments = await this.getSessionPayments(session);
    const computed = this.calculateCashTotals(payments);

    return {
      session: this.serializeSession(session, computed),
      payments,
    };
  }

  async openSession(payload: OpenCashSessionDto) {
    const { business, branch, terminal, admin } = await this.getDemoContext(
      payload.terminalCode,
    );

    const existingOpenSession = await this.prisma.cashSession.findFirst({
      where: {
        businessId: business.id,
        branchId: branch.id,
        terminalId: terminal.id,
        status: CashSessionStatus.Open,
      },
    });

    if (existingOpenSession) {
      throw new BadRequestException(
        `Cash session ${existingOpenSession.sessionNumber} is already open for ${terminal.code}.`,
      );
    }

    const openedById = payload.openedById ?? admin?.id ?? 'softzeno-admin';
    const openedByName =
      payload.openedByName ??
      (admin ? `${admin.firstName} ${admin.lastName}` : 'Softzeno Admin');

    const sessionNumber = await this.buildSessionNumber({
      businessId: business.id,
      branchId: branch.id,
      branchCode: branch.code,
      terminalId: terminal.id,
      terminalCode: terminal.code,
    });

    const openingCash = this.roundMoney(payload.openingCash);

    const session = await this.prisma.cashSession.create({
      data: {
        businessId: business.id,
        branchId: branch.id,
        terminalId: terminal.id,
        sessionNumber,
        openingCash: this.toDecimal(openingCash),
        cashIn: this.toDecimal(0),
        cashOut: this.toDecimal(0),
        expectedCash: this.toDecimal(openingCash),
        status: CashSessionStatus.Open,
        openedById,
        openedByName,
      },
    });

    await this.prisma.auditTrail.create({
      data: {
        businessId: business.id,
        branchId: branch.id,
        terminalId: terminal.id,
        action: 'CashSessionOpened',
        entityType: 'CashSession',
        entityId: session.id,
        message: `Cash session ${session.sessionNumber} opened with ${openingCash}.`,
        performedById: openedById,
        performedByName: openedByName,
        metadata: {
          openingCash,
          terminalCode: terminal.code,
        },
      },
    });

    return {
      session: this.serializeSession(session),
    };
  }

  async closeSession(payload: CloseCashSessionDto) {
    const { business, branch, terminal, admin } = await this.getDemoContext();

    const session = await this.prisma.cashSession.findFirst({
      where: {
        businessId: business.id,
        branchId: branch.id,
        terminalId: terminal.id,
        status: CashSessionStatus.Open,
      },
      orderBy: {
        openedAt: 'desc',
      },
    });

    if (!session) {
      throw new NotFoundException('No open cash session found.');
    }

    const payments = await this.getSessionPayments(session);
    const computed = this.calculateCashTotals(payments);

    const openingCash = Number(session.openingCash);
    const expectedCash = this.roundMoney(
      openingCash + computed.cashIn - computed.cashOut,
    );
    const countedCash = this.roundMoney(payload.countedCash);
    const difference = this.roundMoney(countedCash - expectedCash);

    const closedById = payload.closedById ?? admin?.id ?? 'softzeno-admin';
    const closedByName =
      payload.closedByName ??
      (admin ? `${admin.firstName} ${admin.lastName}` : 'Softzeno Admin');

    const closedSession = await this.prisma.$transaction(async (tx) => {
      await tx.paymentReceipt.updateMany({
        where: {
          businessId: session.businessId,
          branchId: session.branchId,
          terminalId: session.terminalId,
          cashSessionId: null,
          receivedAt: {
            gte: session.openedAt,
          },
          status: {
            in: [PaymentReceiptStatus.Completed, PaymentReceiptStatus.Refunded],
          },
          OR: [
            {
              method: PaymentMethod.Cash,
            },
            {
              method: PaymentMethod.Mixed,
            },
          ],
        },
        data: {
          cashSessionId: session.id,
        },
      });

      const updatedSession = await tx.cashSession.update({
        where: {
          id: session.id,
        },
        data: {
          cashIn: this.toDecimal(computed.cashIn),
          cashOut: this.toDecimal(computed.cashOut),
          expectedCash: this.toDecimal(expectedCash),
          countedCash: this.toDecimal(countedCash),
          difference: this.toDecimal(difference),
          status: CashSessionStatus.Closed,
          closedById,
          closedByName,
          closedAt: new Date(),
          closeNote: payload.closeNote?.trim() || null,
        },
      });

      await tx.auditTrail.create({
        data: {
          businessId: business.id,
          branchId: branch.id,
          terminalId: terminal.id,
          action: 'CashSessionClosed',
          entityType: 'CashSession',
          entityId: session.id,
          message: `Cash session ${session.sessionNumber} closed. Difference: ${difference}.`,
          performedById: closedById,
          performedByName: closedByName,
          metadata: {
            openingCash,
            cashIn: computed.cashIn,
            cashOut: computed.cashOut,
            expectedCash,
            countedCash,
            difference,
            closeNote: payload.closeNote ?? null,
          },
        },
      });

      return updatedSession;
    });

    return {
      session: this.serializeSession(closedSession),
      payments,
    };
  }

  async listSessions() {
    const { business, branch, terminal } = await this.getDemoContext();

    const sessions = await this.prisma.cashSession.findMany({
      where: {
        businessId: business.id,
        branchId: branch.id,
        terminalId: terminal.id,
      },
      orderBy: {
        openedAt: 'desc',
      },
      take: 50,
    });

    return {
      total: sessions.length,
      sessions: sessions.map((session) => this.serializeSession(session)),
    };
  }
}
