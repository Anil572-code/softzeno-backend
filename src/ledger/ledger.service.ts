import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { LedgerEntry, Prisma } from '@prisma/client';
import { CreateLedgerAccountDto } from './dto/create-ledger-account.dto';
import { UpdateLedgerAccountDto } from './dto/update-ledger-account.dto';
import { PrismaService } from '../prisma/prisma.service';
import { CollectLedgerPaymentDto } from './dto/collect-ledger-payment.dto';

const DEMO_BUSINESS_ID = 'softzeno-demo-business';
const DEMO_BRANCH_CODE = 'BHR';
const DEMO_TERMINAL_CODE = 'POS-01';
const DEMO_ADMIN_USERNAME = '@admin';

type LedgerTransactionClient = Prisma.TransactionClient;

type TargetEntrySummary = {
  targetEntry: LedgerEntry;
  allocatedAmount: number;
  remainingAmount: number;
  requestedAmount?: number;
};

@Injectable()
export class LedgerService {
  constructor(private readonly prisma: PrismaService) {}

  private roundMoney(value: number) {
    return Math.round((value + Number.EPSILON) * 100) / 100;
  }

  private async getDemoActorContext(tx: LedgerTransactionClient) {
    const business = await tx.business.findUnique({
      where: {
        id: DEMO_BUSINESS_ID,
      },
    });

    if (!business) {
      throw new NotFoundException('Demo business was not found.');
    }

    const branch = await tx.branch.findFirst({
      where: {
        businessId: business.id,
        code: DEMO_BRANCH_CODE,
        isActive: true,
      },
    });

    if (!branch) {
      throw new NotFoundException('Demo branch was not found.');
    }

    const terminal = await tx.terminal.findFirst({
      where: {
        businessId: business.id,
        branchId: branch.id,
        code: DEMO_TERMINAL_CODE,
        isActive: true,
      },
    });

    if (!terminal) {
      throw new NotFoundException('Demo terminal was not found.');
    }

    const actor = await tx.user.findFirst({
      where: {
        businessId: business.id,
        username: DEMO_ADMIN_USERNAME,
        status: 'Active',
        isDeleted: false,
      },
    });

    if (!actor) {
      throw new NotFoundException('Demo admin user was not found.');
    }

    return {
      business,
      branch,
      terminal,
      actor,
      actorName: `${actor.firstName} ${actor.lastName}`,
    };
  }

  private getPaymentSource(accountType: string) {
    if (accountType === 'Supplier') return 'SupplierPayment';
    if (accountType === 'Staff') return 'StaffSettlement';

    return 'LedgerCollection';
  }

  private getSettlementStatus(method: string) {
    if (method === 'QR' || method === 'Card') return 'Pending';

    return 'NotRequired';
  }

  private getReceiptNumber() {
    return `LEDGER-${Date.now()}`;
  }

  private async attachAllocationsToEntries(params: {
    businessId: string;
    entries: LedgerEntry[];
  }) {
    const entryIds = params.entries.map((entry) => entry.id);

    if (entryIds.length === 0) {
      return params.entries.map((entry) => ({
        ...entry,
        allocations: [],
      }));
    }

    const allocations = await this.prisma.ledgerAllocation.findMany({
      where: {
        businessId: params.businessId,
        paymentEntryId: {
          in: entryIds,
        },
      },
      orderBy: {
        createdAt: 'asc',
      },
    });

    const allocationsByPaymentEntryId = new Map<string, typeof allocations>();

    for (const allocation of allocations) {
      const existing =
        allocationsByPaymentEntryId.get(allocation.paymentEntryId) ?? [];

      existing.push(allocation);
      allocationsByPaymentEntryId.set(allocation.paymentEntryId, existing);
    }

    return params.entries.map((entry) => ({
      ...entry,
      allocations: allocationsByPaymentEntryId.get(entry.id) ?? [],
    }));
  }

  async getAccounts() {
    const accounts = await this.prisma.ledgerAccount.findMany({
      where: {
        businessId: DEMO_BUSINESS_ID,
        isArchived: false,
      },
      orderBy: {
        updatedAt: 'desc',
      },
      include: {
        entries: {
          where: {
            isVoided: false,
          },
          orderBy: {
            date: 'desc',
          },
        },
      },
    });

    const allEntries = accounts.flatMap((account) => account.entries);
    const entriesWithAllocations = await this.attachAllocationsToEntries({
      businessId: DEMO_BUSINESS_ID,
      entries: allEntries,
    });

    const entriesByAccountId = new Map<string, typeof entriesWithAllocations>();

    for (const entry of entriesWithAllocations) {
      const existing = entriesByAccountId.get(entry.accountId) ?? [];

      existing.push(entry);
      entriesByAccountId.set(entry.accountId, existing);
    }

    return {
      total: accounts.length,
      accounts: accounts.map((account) => {
        const entries = entriesByAccountId.get(account.id) ?? [];

        const debit = entries.reduce(
          (sum, entry) => sum + Number(entry.debit),
          0,
        );
        const credit = entries.reduce(
          (sum, entry) => sum + Number(entry.credit),
          0,
        );

        return {
          ...account,
          entries,
          balance: this.roundMoney(debit - credit),
        };
      }),
    };
  }
  async createAccount(payload: CreateLedgerAccountDto) {
    const context = await this.prisma.$transaction(async (tx) => {
      return this.getDemoActorContext(tx);
    });

    const name = payload.name.trim();
    const phone = payload.phone?.trim() || null;
    const email = payload.email?.trim() || null;
    const address = payload.address?.trim() || null;

    if (!name) {
      throw new BadRequestException('Ledger account name is required.');
    }

    const existing = await this.prisma.ledgerAccount.findFirst({
      where: {
        businessId: context.business.id,
        branchId: context.branch.id,
        type: payload.type,
        name: {
          equals: name,
          mode: 'insensitive',
        },
        isArchived: false,
      },
    });

    if (existing) {
      throw new BadRequestException(
        `${payload.type} ledger account already exists.`,
      );
    }

    return this.prisma.ledgerAccount.create({
      data: {
        businessId: context.business.id,
        branchId: context.branch.id,
        type: payload.type,
        name,
        phone,
        email,
        address,
        creditLimit: this.roundMoney(Number(payload.creditLimit ?? 0)),
        isActive: true,
        isArchived: false,
      },
    });
  }
  async updateAccount(id: string, payload: UpdateLedgerAccountDto) {
    const context = await this.prisma.$transaction(async (tx) => {
      return this.getDemoActorContext(tx);
    });

    const existingAccount = await this.prisma.ledgerAccount.findFirst({
      where: {
        id,
        businessId: context.business.id,
        branchId: context.branch.id,
        isArchived: false,
      },
    });

    if (!existingAccount) {
      throw new NotFoundException('Ledger account not found.');
    }

    const cleanName = payload.name?.trim();
    const cleanPhone = payload.phone?.trim();
    const cleanEmail = payload.email?.trim();
    const cleanAddress = payload.address?.trim();

    if (payload.name !== undefined && !cleanName) {
      throw new BadRequestException('Account name is required.');
    }

    if (cleanPhone && cleanPhone.length !== 10) {
      throw new BadRequestException('Phone number must be 10 digits.');
    }

    if (
      cleanName &&
      (cleanName.toLowerCase() !== existingAccount.name.toLowerCase() ||
        (payload.type ?? existingAccount.type) !== existingAccount.type)
    ) {
      const duplicate = await this.prisma.ledgerAccount.findFirst({
        where: {
          businessId: context.business.id,
          branchId: context.branch.id,
          type: payload.type ?? existingAccount.type,
          name: {
            equals: cleanName,
            mode: 'insensitive',
          },
          id: {
            not: id,
          },
          isArchived: false,
        },
      });

      if (duplicate) {
        throw new BadRequestException(
          `${payload.type ?? existingAccount.type} ledger account already exists.`,
        );
      }
    }

    const data: {
      type?: 'Customer' | 'Staff' | 'Supplier';
      name?: string;
      phone?: string | null;
      email?: string | null;
      address?: string | null;
      creditLimit?: number;
      isActive?: boolean;
      isCreditBlocked?: boolean;
    } = {};

    if (payload.type !== undefined) data.type = payload.type;
    if (payload.name !== undefined) data.name = cleanName;
    if (payload.phone !== undefined) data.phone = cleanPhone || null;
    if (payload.email !== undefined) data.email = cleanEmail || null;
    if (payload.address !== undefined) data.address = cleanAddress || null;

    if (payload.creditLimit !== undefined) {
      data.creditLimit = this.roundMoney(Number(payload.creditLimit ?? 0));
    }

    if (payload.isActive !== undefined) {
      data.isActive = payload.isActive;
    }

    if (payload.isCreditBlocked !== undefined) {
      data.isCreditBlocked = payload.isCreditBlocked;
    }

    return this.prisma.ledgerAccount.update({
      where: { id },
      data,
    });
  }
  async getAccountStatement(accountId: string) {
    const account = await this.prisma.ledgerAccount.findUnique({
      where: {
        id: accountId,
      },
      include: {
        entries: {
          where: {
            isVoided: false,
          },
          orderBy: {
            date: 'asc',
          },
        },
      },
    });

    if (!account) {
      throw new NotFoundException('Ledger account was not found.');
    }

    const entries = await this.attachAllocationsToEntries({
      businessId: account.businessId,
      entries: account.entries,
    });

    const debit = entries.reduce((sum, entry) => sum + Number(entry.debit), 0);
    const credit = entries.reduce(
      (sum, entry) => sum + Number(entry.credit),
      0,
    );

    const allocations = await this.prisma.ledgerAllocation.findMany({
      where: {
        ledgerAccountId: account.id,
      },
      orderBy: {
        createdAt: 'asc',
      },
    });

    return {
      account,
      entries,
      allocations,
      balance: this.roundMoney(debit - credit),
    };
  }

  private async getRemainingForTargetEntry(
    targetEntryId: string,
    tx: LedgerTransactionClient,
  ): Promise<TargetEntrySummary> {
    const targetEntry = await tx.ledgerEntry.findUnique({
      where: {
        id: targetEntryId,
      },
    });

    if (!targetEntry) {
      throw new NotFoundException('Target ledger entry was not found.');
    }

    if (targetEntry.isVoided) {
      throw new BadRequestException(
        'Cannot allocate payment to a voided entry.',
      );
    }

    if (Number(targetEntry.debit) <= 0) {
      throw new BadRequestException(
        'Payment can only be allocated to debit entries.',
      );
    }

    const allocations = await tx.ledgerAllocation.findMany({
      where: {
        targetEntryId,
      },
    });

    const allocatedAmount = allocations.reduce(
      (sum, allocation) => sum + Number(allocation.appliedAmount),
      0,
    );

    const originalDebit = Number(targetEntry.debit);
    const remainingAmount = this.roundMoney(originalDebit - allocatedAmount);

    return {
      targetEntry,
      allocatedAmount: this.roundMoney(allocatedAmount),
      remainingAmount,
    };
  }

  private async refreshInvoiceCreditStatus(
    tx: LedgerTransactionClient,
    invoiceId: string,
  ) {
    const invoice = await tx.invoice.findUnique({
      where: {
        id: invoiceId,
      },
    });

    if (!invoice) return;

    const creditEntry = await tx.ledgerEntry.findFirst({
      where: {
        invoiceId,
        kind: 'PosCreditBill',
        isVoided: false,
      },
    });

    if (!creditEntry) return;

    const allocations = await tx.ledgerAllocation.findMany({
      where: {
        targetEntryId: creditEntry.id,
      },
    });

    const clearedAmount = allocations.reduce(
      (sum, allocation) => sum + Number(allocation.appliedAmount),
      0,
    );

    const creditAmount = Number(invoice.creditAmount);
    const remainingAmount = this.roundMoney(creditAmount - clearedAmount);

    const nextStatus =
      remainingAmount <= 0
        ? 'CreditCleared'
        : clearedAmount > 0
          ? 'CreditPartiallyCleared'
          : 'CreditOpen';

    await tx.invoice.update({
      where: {
        id: invoice.id,
      },
      data: {
        paymentStatus: nextStatus,
      },
    });
  }

  async collectPayment(payload: CollectLedgerPaymentDto) {
    if (payload.allocations.length === 0) {
      throw new BadRequestException('At least one allocation is required.');
    }

    const allocatedTotal = this.roundMoney(
      payload.allocations.reduce(
        (sum, allocation) => sum + allocation.amount,
        0,
      ),
    );

    if (!this.roundMoney(payload.amount) || payload.amount <= 0) {
      throw new BadRequestException(
        'Payment amount must be greater than zero.',
      );
    }

    if (Math.abs(allocatedTotal - this.roundMoney(payload.amount)) > 0.01) {
      throw new BadRequestException(
        'Allocated amount must equal payment amount.',
      );
    }

    const result = await this.prisma.$transaction(async (tx) => {
      const context = await this.getDemoActorContext(tx);

      const account = await tx.ledgerAccount.findUnique({
        where: {
          id: payload.accountId,
        },
      });

      if (!account) {
        throw new NotFoundException('Ledger account was not found.');
      }

      if (account.businessId !== context.business.id) {
        throw new BadRequestException('Ledger account business mismatch.');
      }

      if (account.isArchived || !account.isActive) {
        throw new BadRequestException(
          'Ledger account is inactive or archived.',
        );
      }

      const targetSummaries: TargetEntrySummary[] = [];

      for (const allocation of payload.allocations) {
        if (allocation.amount <= 0) {
          throw new BadRequestException(
            'Allocation amount must be greater than zero.',
          );
        }

        const summary = await this.getRemainingForTargetEntry(
          allocation.targetEntryId,
          tx,
        );

        if (summary.targetEntry.accountId !== account.id) {
          throw new BadRequestException(
            'Allocation target does not belong to selected account.',
          );
        }

        if (allocation.amount > summary.remainingAmount) {
          throw new BadRequestException(
            `Allocation for ${summary.targetEntry.reference} exceeds remaining amount.`,
          );
        }

        targetSummaries.push({
          ...summary,
          requestedAmount: this.roundMoney(allocation.amount),
        });
      }

      const receiptNumber = this.getReceiptNumber();
      const source = this.getPaymentSource(account.type);
      const settlementStatus = this.getSettlementStatus(payload.method);

      const paymentReceipt = await tx.paymentReceipt.create({
        data: {
          businessId: context.business.id,
          branchId: context.branch.id,
          terminalId: context.terminal.id,
          receiptNumber,
          source,
          sourceReference: receiptNumber,
          accountId: account.id,
          accountName: account.name,
          method: payload.method,
          amount: this.roundMoney(payload.amount),
          receivedAmount:
            payload.method === 'Cash' ? this.roundMoney(payload.amount) : null,
          changeReturn: payload.method === 'Cash' ? 0 : null,
          provider: payload.provider ?? null,
          referenceNumber: payload.referenceNumber ?? null,
          bankName: payload.bankName ?? null,
          status: 'Completed',
          settlementStatus,
          receivedById: context.actor.id,
          receivedByName: context.actorName,
          parts: {
            create: [
              {
                method: payload.method,
                amount: this.roundMoney(payload.amount),
                provider: payload.provider ?? null,
                referenceNumber: payload.referenceNumber ?? null,
                bankName: payload.bankName ?? null,
              },
            ],
          },
        },
        include: {
          parts: true,
        },
      });

      const paymentEntry = await tx.ledgerEntry.create({
        data: {
          businessId: context.business.id,
          branchId: context.branch.id,
          accountId: account.id,
          reference: receiptNumber,
          kind: 'Payment',
          description: payload.note ?? 'Ledger payment collection',
          debit: 0,
          credit: this.roundMoney(payload.amount),
          paymentMethod: payload.method,
          handledById: context.actor.id,
          handledByName: context.actorName,
          paymentReceiptId: paymentReceipt.id,
        },
      });

      await tx.paymentReceipt.update({
        where: {
          id: paymentReceipt.id,
        },
        data: {
          ledgerEntryId: paymentEntry.id,
        },
      });

      await tx.ledgerAllocation.createMany({
        data: targetSummaries.map((summary) => ({
          businessId: context.business.id,
          ledgerAccountId: account.id,
          paymentEntryId: paymentEntry.id,
          targetEntryId: summary.targetEntry.id,
          targetReference: summary.targetEntry.reference,
          appliedAmount: summary.requestedAmount ?? 0,
        })),
      });

      const createdAllocations = await tx.ledgerAllocation.findMany({
        where: {
          paymentEntryId: paymentEntry.id,
        },
        orderBy: {
          createdAt: 'asc',
        },
      });

      const affectedInvoiceIds = Array.from(
        new Set(
          targetSummaries
            .map((summary) => summary.targetEntry.invoiceId)
            .filter((invoiceId): invoiceId is string => Boolean(invoiceId)),
        ),
      );

      for (const invoiceId of affectedInvoiceIds) {
        await this.refreshInvoiceCreditStatus(tx, invoiceId);
      }

      const updatedAccount = await tx.ledgerAccount.findUnique({
        where: {
          id: account.id,
        },
        include: {
          entries: {
            where: {
              isVoided: false,
            },
            orderBy: {
              date: 'desc',
            },
          },
        },
      });

      return {
        account: updatedAccount,
        paymentReceipt: {
          ...paymentReceipt,
          ledgerEntryId: paymentEntry.id,
        },
        paymentEntry: {
          ...paymentEntry,
          allocations: createdAllocations,
        },
        allocations: createdAllocations,
      };
    });

    return {
      status: 'success',
      data: result,
    };
  }
}
