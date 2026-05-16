import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';

const DEMO_BUSINESS_ID = 'softzeno-demo-business';
const DEMO_BRANCH_CODE = 'BHR';
const TAX_INVOICE_TYPE = 'TaxInvoice';

@Injectable()
export class FiscalService {
  constructor(private readonly prisma: PrismaService) {}

  private formatInvoiceNumber(prefix: string, sequence: number) {
    return `${prefix}-${String(sequence).padStart(6, '0')}`;
  }

  private async getDemoBranch() {
    const branch = await this.prisma.branch.findFirst({
      where: {
        businessId: DEMO_BUSINESS_ID,
        code: DEMO_BRANCH_CODE,
        isActive: true,
      },
    });

    if (!branch) {
      throw new NotFoundException('Demo branch was not found. Run seed first.');
    }

    return branch;
  }

  async getCurrentFiscalContext() {
    const branch = await this.getDemoBranch();

    const fiscalYear = await this.prisma.fiscalYear.findFirst({
      where: {
        businessId: DEMO_BUSINESS_ID,
        branchId: branch.id,
        status: 'Open',
      },
      orderBy: {
        startsAt: 'desc',
      },
    });

    if (!fiscalYear) {
      throw new NotFoundException(
        'Open fiscal year was not found. Run seed first.',
      );
    }

    const invoiceSequence = await this.prisma.invoiceSequence.findFirst({
      where: {
        businessId: DEMO_BUSINESS_ID,
        branchId: branch.id,
        fiscalYearId: fiscalYear.id,
        invoiceType: TAX_INVOICE_TYPE,
      },
    });

    if (!invoiceSequence) {
      throw new NotFoundException(
        'Invoice sequence was not found. Run seed first.',
      );
    }

    return {
      branch,
      fiscalYear,
      invoiceSequence: {
        id: invoiceSequence.id,
        invoiceType: invoiceSequence.invoiceType,
        prefix: invoiceSequence.prefix,
        currentSequence: invoiceSequence.currentSequence,
        lastInvoiceNumber: invoiceSequence.lastInvoiceNumber,
        locked: invoiceSequence.locked,
        nextPreviewNumber: this.formatInvoiceNumber(
          invoiceSequence.prefix,
          invoiceSequence.currentSequence + 1,
        ),
      },
    };
  }

  async previewNextInvoiceNumber() {
    const context = await this.getCurrentFiscalContext();

    return {
      fiscalYear: {
        id: context.fiscalYear.id,
        label: context.fiscalYear.label,
        status: context.fiscalYear.status,
      },
      sequence: {
        id: context.invoiceSequence.id,
        invoiceType: context.invoiceSequence.invoiceType,
        prefix: context.invoiceSequence.prefix,
        currentSequence: context.invoiceSequence.currentSequence,
        nextPreviewNumber: context.invoiceSequence.nextPreviewNumber,
        locked: context.invoiceSequence.locked,
      },
    };
  }

  async issueNextInvoiceNumberForDemoOnly() {
    const context = await this.getCurrentFiscalContext();

    if (context.fiscalYear.status !== 'Open') {
      throw new BadRequestException('Fiscal year is not open.');
    }

    if (context.invoiceSequence.locked) {
      throw new BadRequestException('Invoice sequence is locked.');
    }

    const updatedSequence = await this.prisma.$transaction(async (tx) => {
      const sequence = await tx.invoiceSequence.findUnique({
        where: {
          id: context.invoiceSequence.id,
        },
      });

      if (!sequence) {
        throw new NotFoundException('Invoice sequence was not found.');
      }

      if (sequence.locked) {
        throw new BadRequestException('Invoice sequence is locked.');
      }

      const nextSequence = sequence.currentSequence + 1;
      const nextInvoiceNumber = this.formatInvoiceNumber(
        sequence.prefix,
        nextSequence,
      );

      return tx.invoiceSequence.update({
        where: {
          id: sequence.id,
        },
        data: {
          currentSequence: nextSequence,
          lastInvoiceNumber: nextInvoiceNumber,
        },
      });
    });

    return {
      invoiceType: updatedSequence.invoiceType,
      prefix: updatedSequence.prefix,
      issuedSequence: updatedSequence.currentSequence,
      issuedInvoiceNumber: updatedSequence.lastInvoiceNumber,
      nextPreviewNumber: this.formatInvoiceNumber(
        updatedSequence.prefix,
        updatedSequence.currentSequence + 1,
      ),
      warning:
        'Demo endpoint only. In production, invoice numbers must be issued inside finalizeInvoice transaction.',
    };
  }
}
