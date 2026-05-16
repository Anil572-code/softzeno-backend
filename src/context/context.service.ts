import { Injectable, NotFoundException } from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ContextService {
  constructor(private readonly prisma: PrismaService) {}

  async getDemoContext() {
    const business = await this.prisma.business.findUnique({
      where: {
        id: 'softzeno-demo-business',
      },
    });

    if (!business) {
      throw new NotFoundException(
        'Demo business was not found. Run seed first.',
      );
    }

    const branch = await this.prisma.branch.findFirst({
      where: {
        businessId: business.id,
        code: 'BHR',
      },
    });

    if (!branch) {
      throw new NotFoundException('Demo branch was not found. Run seed first.');
    }

    const terminal = await this.prisma.terminal.findFirst({
      where: {
        businessId: business.id,
        branchId: branch.id,
        code: 'POS-01',
      },
    });

    if (!terminal) {
      throw new NotFoundException(
        'Demo terminal was not found. Run seed first.',
      );
    }

    const user = await this.prisma.user.findFirst({
      where: {
        businessId: business.id,
        username: '@admin',
      },
      include: {
        role: {
          include: {
            permissions: true,
          },
        },
      },
    });

    if (!user) {
      throw new NotFoundException(
        'Demo admin user was not found. Run seed first.',
      );
    }

    const fiscalYear = await this.prisma.fiscalYear.findFirst({
      where: {
        businessId: business.id,
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
        businessId: business.id,
        branchId: branch.id,
        fiscalYearId: fiscalYear.id,
        invoiceType: 'TaxInvoice',
      },
    });

    if (!invoiceSequence) {
      throw new NotFoundException(
        'Invoice sequence was not found. Run seed first.',
      );
    }

    return {
      business,
      branch,
      terminal,
      actor: {
        id: user.id,
        name: `${user.firstName} ${user.lastName}`,
        username: user.username,
        role: user.role.name,
        branchId: user.branchId,
        maxDiscountPercent: user.maxDiscountPercent,
      },
      permissions: user.role.permissions.map((permission) => ({
        module: permission.module,
        canView: permission.canView,
        canCreate: permission.canCreate,
        canEdit: permission.canEdit,
        canDelete: permission.canDelete,
        canExport: permission.canExport,
        canApprove: permission.canApprove,
      })),
      fiscalYear,
      invoiceSequence: {
        id: invoiceSequence.id,
        invoiceType: invoiceSequence.invoiceType,
        prefix: invoiceSequence.prefix,
        currentSequence: invoiceSequence.currentSequence,
        lastInvoiceNumber: invoiceSequence.lastInvoiceNumber,
        locked: invoiceSequence.locked,
        nextPreviewNumber: `${invoiceSequence.prefix}-${String(
          invoiceSequence.currentSequence + 1,
        ).padStart(6, '0')}`,
      },
    };
  }
}
