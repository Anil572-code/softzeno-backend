import { BadRequestException, Injectable } from '@nestjs/common';
import {
  PaymentMethod,
  PaymentReceiptStatus,
  SettlementStatus,
} from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';
import { SettlePaymentsDto } from './dto/settle-payments.dto';

const DEMO_BUSINESS_ID = 'softzeno-demo-business';
const DEMO_ADMIN_ID = 'softzeno-demo-admin';
const DEMO_ADMIN_NAME = 'Softzeno Admin';

@Injectable()
export class PaymentsSettlementService {
  constructor(private readonly prisma: PrismaService) {}

  private createSettlementBatchId() {
    const now = new Date();
    const datePart = now.toISOString().slice(0, 10).replace(/-/g, '');

    return `SET-${datePart}-${String(now.getTime()).slice(-6)}`;
  }

  private isSettlementEligible(payment: {
    status: PaymentReceiptStatus;
    settlementStatus: SettlementStatus;
    method: PaymentMethod;
  }) {
    if (payment.status !== PaymentReceiptStatus.Completed) return false;

    if (
      payment.settlementStatus !== SettlementStatus.Pending &&
      payment.settlementStatus !== SettlementStatus.PartiallySettled
    ) {
      return false;
    }

    return (
      payment.method === PaymentMethod.QR ||
      payment.method === PaymentMethod.Card ||
      payment.method === PaymentMethod.Mixed
    );
  }

  async markSettled(payload: SettlePaymentsDto) {
    const paymentIds = Array.from(
      new Set(payload.paymentIds.map((id) => id.trim()).filter(Boolean)),
    );

    if (paymentIds.length === 0) {
      throw new BadRequestException('At least one payment is required.');
    }

    const settlementReference = payload.settlementReference.trim();

    if (!settlementReference) {
      throw new BadRequestException('Settlement reference is required.');
    }

    const settledAt = payload.settledAt
      ? new Date(payload.settledAt)
      : new Date();

    if (Number.isNaN(settledAt.getTime())) {
      throw new BadRequestException('Settlement date is invalid.');
    }

    const settlementBatchId =
      payload.settlementBatchId?.trim() || this.createSettlementBatchId();

    const settledById = payload.settledById?.trim() || DEMO_ADMIN_ID;
    const settledByName = payload.settledByName?.trim() || DEMO_ADMIN_NAME;
    const settlementNote = payload.note?.trim() || null;

    return this.prisma.$transaction(async (tx) => {
      const payments = await tx.paymentReceipt.findMany({
        where: {
          businessId: DEMO_BUSINESS_ID,
          id: {
            in: paymentIds,
          },
        },
        include: {
          parts: true,
        },
      });

      if (payments.length !== paymentIds.length) {
        throw new BadRequestException(
          'One or more selected payments were not found.',
        );
      }

      const ineligiblePayments = payments.filter(
        (payment) => !this.isSettlementEligible(payment),
      );

      if (ineligiblePayments.length > 0) {
        throw new BadRequestException(
          `These payments cannot be settled: ${ineligiblePayments
            .map((payment) => payment.receiptNumber)
            .join(', ')}`,
        );
      }

      await tx.paymentReceipt.updateMany({
        where: {
          businessId: DEMO_BUSINESS_ID,
          id: {
            in: paymentIds,
          },
        },
        data: {
          settlementStatus: SettlementStatus.Settled,
          settlementBatchId,
          settlementReference,
          settledAt,
          settledById,
          settledByName,
          settlementNote,
          bankName: payload.bankName?.trim() || undefined,
        },
      });

      await tx.auditTrail.createMany({
        data: payments.map((payment) => ({
          businessId: payment.businessId,
          branchId: payment.branchId,
          terminalId: payment.terminalId,
          action: 'Payment Settled',
          entityType: 'PaymentReceipt',
          entityId: payment.id,
          message: `Payment receipt ${payment.receiptNumber} settled.`,
          performedById: settledById,
          performedByName: settledByName,
          performedAt: settledAt,
          metadata: {
            receiptNumber: payment.receiptNumber,
            source: payment.source,
            sourceReference: payment.sourceReference,
            method: payment.method,
            amount: Number(payment.amount),
            settlementBatchId,
            settlementReference,
            bankName: payload.bankName?.trim() || null,
            note: settlementNote,
          },
        })),
      });

      const updatedPayments = await tx.paymentReceipt.findMany({
        where: {
          businessId: DEMO_BUSINESS_ID,
          id: {
            in: paymentIds,
          },
        },
        include: {
          parts: true,
        },
        orderBy: {
          receivedAt: 'desc',
        },
      });

      return {
        status: 'success',
        settlement: {
          settlementBatchId,
          settlementReference,
          settledAt,
          settledById,
          settledByName,
          paymentCount: updatedPayments.length,
        },
        payments: updatedPayments,
      };
    });
  }
}
