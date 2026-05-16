import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  InventoryItem,
  InventoryItemStatus,
  InventorySection,
  InventoryStockActionType,
  Prisma,
} from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';
import {
  CreateInventoryCategoryDto,
  CreateRecipeIngredientDto,
  RecipeIngredientsQueryDto,
  UpdateRecipeIngredientDto,
  CreateInventoryItemDto,
  CreateInventoryItemTypeDto,
  CreateInventoryLocationDto,
  CreateInventoryStockActionReasonDto,
  CreateInventorySupplierDto,
  CreateStockActionDto,
  InventoryBatchesQueryDto,
  InventoryMovementsQueryDto,
  InventoryStockActionDtoType,
  InventoryStockActionReasonsQueryDto,
  TrashInventoryItemDto,
  UpdateInventoryCategoryDto,
  UpdateInventoryItemDto,
  UpdateInventoryItemTypeDto,
  UpdateInventoryLocationDto,
  UpdateInventorySettingStatusDto,
  UpdateInventoryStockActionReasonDto,
  UpdateInventorySupplierDto,
} from './dto/inventory.dto';

const DEFAULT_BUSINESS_ID = 'softzeno-demo-business';
const DEFAULT_BRANCH_CODE = 'BHR';
const DEFAULT_TERMINAL_CODE = 'POS-01';
const DEFAULT_ADMIN_USERNAME = '@admin';

type StockStatus = 'In Stock' | 'Low Stock' | 'Out of Stock';
type MovementLabel =
  | 'Stock Added'
  | 'Stock Reduced'
  | 'Wastage'
  | 'Manual Adjustment'
  | 'Returned to Supplier'
  | 'Opening Stock';

@Injectable()
export class InventoryService {
  constructor(private readonly prisma: PrismaService) {}
  private async getAccountingContext(tx: Prisma.TransactionClient) {
    const business = await tx.business.findUnique({
      where: { id: DEFAULT_BUSINESS_ID },
    });

    if (!business) {
      throw new NotFoundException('Demo business was not found.');
    }

    const branch = await tx.branch.findFirst({
      where: {
        businessId: business.id,
        code: DEFAULT_BRANCH_CODE,
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
        code: DEFAULT_TERMINAL_CODE,
        isActive: true,
      },
    });

    if (!terminal) {
      throw new NotFoundException('Demo terminal was not found.');
    }

    const actor = await tx.user.findFirst({
      where: {
        businessId: business.id,
        username: DEFAULT_ADMIN_USERNAME,
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

  private roundMoney(value: number) {
    return Math.round((value + Number.EPSILON) * 100) / 100;
  }

  private getPaymentSettlementStatus(method: 'Cash' | 'QR' | 'Card') {
    return method === 'Cash' ? 'NotRequired' : 'Pending';
  }

  private getSupplierPurchaseReference() {
    return `SUP-PUR-${Date.now()}`;
  }

  private getSupplierPaymentReceiptNumber() {
    return `SUP-PAY-${Date.now()}`;
  }
  private businessId() {
    return DEFAULT_BUSINESS_ID;
  }

  private decimal(value: unknown, fallback = 0) {
    const parsed = Number(value);

    if (!Number.isFinite(parsed) || parsed < 0) {
      return new Prisma.Decimal(fallback);
    }

    return new Prisma.Decimal(parsed);
  }

  private number(value: unknown, fallback = 0) {
    const parsed = Number(value);

    if (!Number.isFinite(parsed)) return fallback;

    return parsed;
  }

  private stockStatus(
    item: Pick<InventoryItem, 'currentStock' | 'lowStockLimit'>,
  ): StockStatus {
    const currentStock = Number(item.currentStock);
    const lowStockLimit = Number(item.lowStockLimit);

    if (currentStock <= 0) return 'Out of Stock';
    if (lowStockLimit > 0 && currentStock <= lowStockLimit) return 'Low Stock';

    return 'In Stock';
  }

  private itemSelectInclude() {
    return {
      category: true,
      itemType: true,
      location: true,
    };
  }
  private async attachSupplierNamesToItems<
    T extends InventoryItem & {
      category?: { name: string } | null;
      itemType?: { name: string } | null;
      location?: { name: string } | null;
    },
  >(items: T[]) {
    const supplierIds = Array.from(
      new Set(items.map((item) => item.supplierId).filter(Boolean) as string[]),
    );

    if (supplierIds.length === 0) {
      return items.map((item) => ({ ...item, supplierName: '' }));
    }

    const suppliers = await this.prisma.ledgerAccount.findMany({
      where: {
        businessId: this.businessId(),
        type: 'Supplier',
        id: {
          in: supplierIds,
        },
      },
      select: {
        id: true,
        name: true,
      },
    });

    const supplierNameById = new Map(
      suppliers.map((supplier) => [supplier.id, supplier.name]),
    );

    return items.map((item) => ({
      ...item,
      supplierName: item.supplierId
        ? (supplierNameById.get(item.supplierId) ?? '')
        : '',
    }));
  }
  private formatItem(
    item: InventoryItem & {
      category?: { name: string } | null;
      itemType?: { name: string } | null;
      location?: { name: string } | null;
      supplierName?: string;
    },
  ) {
    const currentStock = Number(item.currentStock);
    const lowStockLimit = Number(item.lowStockLimit);
    const costPrice = Number(item.costPrice);

    return {
      ...item,
      currentStock,
      lowStockLimit,
      costPrice,
      stockValue: currentStock * costPrice,
      categoryName: item.category?.name ?? '',
      itemTypeName: item.itemType?.name ?? '',
      supplierName: item.supplierName ?? '',
      storageLocationName: item.location?.name ?? '',
      stockStatus: this.stockStatus(item),
    };
  }

  private formatBatch(batch: {
    id: string;
    businessId: string;
    itemId: string;
    supplierId: string | null;
    batchNo: string | null;
    quantityAdded: Prisma.Decimal;
    remainingQuantity: Prisma.Decimal;
    unit: string;
    costPrice: Prisma.Decimal;
    purchaseDate: Date;
    expiryDate: Date | null;
    createdAt: Date;
    updatedAt: Date;
    item?: { name: string; section: InventorySection } | null;
    supplier?: { name: string } | null;
  }) {
    return {
      ...batch,
      quantityAdded: Number(batch.quantityAdded),
      remainingQuantity: Number(batch.remainingQuantity),
      costPrice: Number(batch.costPrice),
      itemName: batch.item?.name ?? '',
      section: batch.item?.section ?? null,
      supplierName: batch.supplier?.name ?? '',
    };
  }

  private movementLabel(actionType: InventoryStockActionType): MovementLabel {
    if (actionType === InventoryStockActionType.Add) return 'Stock Added';
    if (actionType === InventoryStockActionType.Reduce) return 'Stock Reduced';
    if (actionType === InventoryStockActionType.Wastage) return 'Wastage';
    if (actionType === InventoryStockActionType.Adjust)
      return 'Manual Adjustment';
    if (actionType === InventoryStockActionType.Return)
      return 'Returned to Supplier';

    return 'Opening Stock';
  }

  private formatMovement(movement: {
    id: string;
    businessId: string;
    itemId: string;
    supplierId: string | null;
    actionType: InventoryStockActionType;
    quantity: Prisma.Decimal;
    unit: string;
    beforeStock: Prisma.Decimal;
    afterStock: Prisma.Decimal;
    reason: string;
    note: string | null;
    performedBy: string;
    batchNo: string | null;
    expiryDate: Date | null;
    createdAt: Date;
    item?: { name: string; section: InventorySection } | null;
    supplier?: { name: string } | null;
  }) {
    return {
      ...movement,
      type: this.movementLabel(movement.actionType),
      itemName: movement.item?.name ?? '',
      section: movement.item?.section ?? null,
      supplierName: movement.supplier?.name ?? '',
      quantity: Number(movement.quantity),
      beforeStock: Number(movement.beforeStock),
      afterStock: Number(movement.afterStock),
    };
  }
  private formatRecipeIngredient(ingredient: {
    id: string;
    businessId: string;
    menuItemId: string;
    inventoryItemId: string;
    quantity: Prisma.Decimal;
    unit: string;
    wastePercent: Prisma.Decimal;
    sortOrder: number;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
    menuItem?: {
      id: string;
      name: string;
      price: Prisma.Decimal;
      status: string;
    } | null;
    inventoryItem?: {
      id: string;
      name: string;
      section: InventorySection;
      unit: string;
      costPrice: Prisma.Decimal;
      currentStock: Prisma.Decimal;
    } | null;
  }) {
    const quantity = Number(ingredient.quantity);
    const wastePercent = Number(ingredient.wastePercent);
    const inventoryCostPrice = Number(ingredient.inventoryItem?.costPrice ?? 0);
    const effectiveQuantity = quantity + quantity * (wastePercent / 100);

    return {
      ...ingredient,
      quantity,
      wastePercent,
      menuItemName: ingredient.menuItem?.name ?? '',
      menuItemPrice: Number(ingredient.menuItem?.price ?? 0),
      inventoryItemName: ingredient.inventoryItem?.name ?? '',
      inventorySection: ingredient.inventoryItem?.section ?? null,
      inventoryUnit: ingredient.inventoryItem?.unit ?? '',
      inventoryCurrentStock: Number(
        ingredient.inventoryItem?.currentStock ?? 0,
      ),
      estimatedCost: effectiveQuantity * inventoryCostPrice,
    };
  }
  private toPrismaActionType(
    actionType: InventoryStockActionDtoType,
  ): InventoryStockActionType {
    if (actionType === InventoryStockActionDtoType.Add) {
      return InventoryStockActionType.Add;
    }

    if (actionType === InventoryStockActionDtoType.Reduce) {
      return InventoryStockActionType.Reduce;
    }

    if (actionType === InventoryStockActionDtoType.Wastage) {
      return InventoryStockActionType.Wastage;
    }

    if (actionType === InventoryStockActionDtoType.Adjust) {
      return InventoryStockActionType.Adjust;
    }

    if (actionType === InventoryStockActionDtoType.Return) {
      return InventoryStockActionType.Return;
    }

    return InventoryStockActionType.Opening;
  }

  private toDtoActionType(
    actionType: InventoryStockActionType | null,
  ): InventoryStockActionDtoType | null {
    if (!actionType) return null;

    if (actionType === InventoryStockActionType.Add) {
      return InventoryStockActionDtoType.Add;
    }

    if (actionType === InventoryStockActionType.Reduce) {
      return InventoryStockActionDtoType.Reduce;
    }

    if (actionType === InventoryStockActionType.Wastage) {
      return InventoryStockActionDtoType.Wastage;
    }

    if (actionType === InventoryStockActionType.Adjust) {
      return InventoryStockActionDtoType.Adjust;
    }

    if (actionType === InventoryStockActionType.Return) {
      return InventoryStockActionDtoType.Return;
    }

    return InventoryStockActionDtoType.Opening;
  }

  async categories() {
    return this.prisma.inventoryCategory.findMany({
      where: { businessId: this.businessId() },
      orderBy: [{ section: 'asc' }, { sortOrder: 'asc' }, { name: 'asc' }],
    });
  }

  async createCategory(dto: CreateInventoryCategoryDto) {
    console.log('CREATE CATEGORY DTO:', dto);

    const name = String(
      dto.name ??
        (dto as unknown as { categoryName?: string }).categoryName ??
        '',
    ).trim();

    if (!name) {
      throw new BadRequestException('Category name is required.');
    }

    const section = dto.section;

    if (section !== 'Kitchen' && section !== 'Bar') {
      throw new BadRequestException('Valid inventory section is required.');
    }

    return this.prisma.inventoryCategory.create({
      data: {
        businessId: this.businessId(),
        section,
        name,
        sortOrder: dto.sortOrder ?? 0,
      },
    });
  }

  async updateCategory(id: string, dto: UpdateInventoryCategoryDto) {
    await this.ensureCategory(id);

    return this.prisma.inventoryCategory.update({
      where: { id },
      data: {
        section: dto.section,
        name: dto.name?.trim(),
        sortOrder: dto.sortOrder,
      },
    });
  }

  async updateCategoryStatus(id: string, dto: UpdateInventorySettingStatusDto) {
    await this.ensureCategory(id);

    return this.prisma.inventoryCategory.update({
      where: { id },
      data: { status: dto.status },
    });
  }

  async itemTypes() {
    return this.prisma.inventoryItemType.findMany({
      where: { businessId: this.businessId() },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });
  }

  async createItemType(dto: CreateInventoryItemTypeDto) {
    console.log('CREATE ITEM TYPE DTO:', dto);

    const name = String(
      dto.name ??
        (dto as unknown as { itemTypeName?: string }).itemTypeName ??
        '',
    ).trim();

    if (!name) {
      throw new BadRequestException('Item type name is required.');
    }

    return this.prisma.inventoryItemType.create({
      data: {
        businessId: this.businessId(),
        name,
        sortOrder: dto.sortOrder ?? 0,
      },
    });
  }

  async updateItemType(id: string, dto: UpdateInventoryItemTypeDto) {
    await this.ensureItemType(id);

    return this.prisma.inventoryItemType.update({
      where: { id },
      data: {
        name: dto.name?.trim(),
        sortOrder: dto.sortOrder,
      },
    });
  }

  async updateItemTypeStatus(id: string, dto: UpdateInventorySettingStatusDto) {
    await this.ensureItemType(id);

    return this.prisma.inventoryItemType.update({
      where: { id },
      data: { status: dto.status },
    });
  }

  async locations() {
    return this.prisma.inventoryLocation.findMany({
      where: { businessId: this.businessId() },
      orderBy: [{ name: 'asc' }],
    });
  }

  async createLocation(dto: CreateInventoryLocationDto) {
    console.log('CREATE LOCATION DTO:', dto);

    const name = String(
      dto.name ??
        (dto as unknown as { locationName?: string }).locationName ??
        '',
    ).trim();

    if (!name) {
      throw new BadRequestException('Storage location name is required.');
    }

    return this.prisma.inventoryLocation.create({
      data: {
        businessId: this.businessId(),
        name,
      },
    });
  }

  async updateLocation(id: string, dto: UpdateInventoryLocationDto) {
    await this.ensureLocation(id);

    return this.prisma.inventoryLocation.update({
      where: { id },
      data: { name: dto.name?.trim() },
    });
  }

  async updateLocationStatus(id: string, dto: UpdateInventorySettingStatusDto) {
    await this.ensureLocation(id);

    return this.prisma.inventoryLocation.update({
      where: { id },
      data: { status: dto.status },
    });
  }

  async suppliers() {
    const accounts = await this.prisma.ledgerAccount.findMany({
      where: {
        businessId: this.businessId(),
        type: 'Supplier',
        isActive: true,
        isArchived: false,
      },
      include: {
        entries: {
          where: {
            isVoided: false,
          },
        },
      },
      orderBy: [{ name: 'asc' }],
    });

    return accounts.map((account) => {
      const debit = account.entries.reduce(
        (sum, entry) => sum + Number(entry.debit),
        0,
      );
      const credit = account.entries.reduce(
        (sum, entry) => sum + Number(entry.credit),
        0,
      );

      const payableAmount = Math.max(
        Math.round((debit - credit + Number.EPSILON) * 100) / 100,
        0,
      );

      return {
        id: account.id,
        businessId: account.businessId,
        name: account.name,
        phone: account.phone,
        address: account.address,
        payableAmount,
        paymentStatus:
          payableAmount <= 0 ? 'Paid' : credit > 0 ? 'Partial' : 'Unpaid',
        status: account.isActive ? 'Active' : 'Inactive',
        ledgerAccountId: account.id,
        createdAt: account.createdAt,
        updatedAt: account.updatedAt,
      };
    });
  }

  async createSupplier(dto: CreateInventorySupplierDto) {
    void dto;

    throw new BadRequestException(
      'Create supplier accounts from Ledger. Inventory only displays supplier ledger accounts.',
    );
  }

  async updateSupplier(id: string, dto: UpdateInventorySupplierDto) {
    void id;
    void dto;

    throw new BadRequestException(
      'Edit supplier accounts from Ledger. Inventory only displays supplier ledger accounts.',
    );
  }

  async updateSupplierStatus(id: string, dto: UpdateInventorySettingStatusDto) {
    void id;
    void dto;

    throw new BadRequestException(
      'Enable, disable, or archive supplier accounts from Ledger.',
    );
  }

  async items(query: {
    section?: InventorySection;
    includeTrashed?: string;
    stockStatus?: StockStatus;
  }) {
    const includeTrashed = query.includeTrashed === 'true';

    const items = await this.prisma.inventoryItem.findMany({
      where: {
        businessId: this.businessId(),
        section: query.section,
        isTrashed: includeTrashed ? undefined : false,
      },
      include: this.itemSelectInclude(),
      orderBy: [{ section: 'asc' }, { name: 'asc' }],
    });

    const itemsWithSupplierNames = await this.attachSupplierNamesToItems(items);
    const formatted = itemsWithSupplierNames.map((item) =>
      this.formatItem(item),
    );

    if (query.stockStatus) {
      return formatted.filter((item) => item.stockStatus === query.stockStatus);
    }

    return formatted;
  }

  async item(id: string) {
    const item = await this.prisma.inventoryItem.findFirst({
      where: {
        id,
        businessId: this.businessId(),
      },
      include: this.itemSelectInclude(),
    });

    if (!item) {
      throw new NotFoundException('Inventory item not found.');
    }

    const [itemWithSupplierName] = await this.attachSupplierNamesToItems([
      item,
    ]);
    return this.formatItem(itemWithSupplierName);
  }

  async createItem(dto: CreateInventoryItemDto) {
    const name = dto.name?.trim();

    if (!name) {
      throw new BadRequestException('Item name is required.');
    }

    if (!dto.categoryId) {
      throw new BadRequestException('Category is required.');
    }

    if (!dto.itemTypeId) {
      throw new BadRequestException('Item type is required.');
    }

    if (!dto.unit?.trim()) {
      throw new BadRequestException('Unit is required.');
    }

    await this.ensureCategory(dto.categoryId);
    await this.ensureItemType(dto.itemTypeId);
    const existingItem = await this.prisma.inventoryItem.findFirst({
      where: {
        businessId: this.businessId(),
        section: dto.section,
        name: {
          equals: name,
          mode: 'insensitive',
        },
      },
    });

    if (existingItem) {
      if (existingItem.isTrashed) {
        throw new BadRequestException(
          `${name} already exists in Trash. Restore it from Trash instead of creating a duplicate.`,
        );
      }

      throw new BadRequestException(
        `${name} already exists in ${dto.section} stock.`,
      );
    }
    if (dto.supplierId) {
      await this.ensureSupplier(dto.supplierId);
    }

    if (dto.storageLocationId) {
      await this.ensureLocation(dto.storageLocationId);
    }

    const openingStock = this.number(dto.openingStock);
    const trackExpiry = dto.trackExpiry ?? false;
    const trackBatch = trackExpiry ? true : (dto.trackBatch ?? false);

    const created = await this.prisma.$transaction(async (tx) => {
      const item = await tx.inventoryItem.create({
        data: {
          businessId: this.businessId(),
          name,
          section: dto.section,
          categoryId: dto.categoryId,
          itemTypeId: dto.itemTypeId,
          unit: dto.unit.trim(),
          currentStock: this.decimal(openingStock),
          lowStockLimit: this.decimal(dto.lowStockLimit),
          costPrice: this.decimal(dto.costPrice),
          supplierId: dto.supplierId || null,
          storageLocationId: dto.storageLocationId || null,
          trackBatch,
          trackExpiry,
          status: dto.status ?? InventoryItemStatus.Active,
          bottleSizeMl: dto.bottleSizeMl ?? null,
          itemsPerPacket: dto.itemsPerPacket ?? null,
          lastMovementAt: openingStock > 0 ? new Date() : null,
        },
        include: this.itemSelectInclude(),
      });

      if (openingStock > 0) {
        if (trackBatch) {
          await tx.inventoryStockBatch.create({
            data: {
              businessId: this.businessId(),
              itemId: item.id,
              supplierId: dto.supplierId || null,
              batchNo: null,
              quantityAdded: this.decimal(openingStock),
              remainingQuantity: this.decimal(openingStock),
              unit: item.unit,
              costPrice: this.decimal(dto.costPrice),
              purchaseDate: new Date(),
              expiryDate: null,
            },
          });
        }

        await tx.inventoryStockMovement.create({
          data: {
            businessId: this.businessId(),
            itemId: item.id,
            supplierId: dto.supplierId || null,
            actionType: InventoryStockActionType.Opening,
            quantity: this.decimal(openingStock),
            unit: item.unit,
            beforeStock: this.decimal(0),
            afterStock: this.decimal(openingStock),
            reason: 'Opening stock',
            performedBy: 'Admin',
          },
        });
      }

      return item;
    });

    return this.formatItem(created);
  }

  async updateItem(id: string, dto: UpdateInventoryItemDto) {
    await this.ensureItem(id);

    if (dto.categoryId) {
      await this.ensureCategory(dto.categoryId);
    }

    if (dto.itemTypeId) {
      await this.ensureItemType(dto.itemTypeId);
    }

    if (dto.supplierId) {
      await this.ensureSupplier(dto.supplierId);
    }

    if (dto.storageLocationId) {
      await this.ensureLocation(dto.storageLocationId);
    }

    const trackExpiry = dto.trackExpiry;
    const trackBatch =
      trackExpiry === true
        ? true
        : dto.trackBatch === undefined
          ? undefined
          : dto.trackBatch;

    const updated = await this.prisma.inventoryItem.update({
      where: { id },
      data: {
        name: dto.name?.trim(),
        section: dto.section,
        categoryId: dto.categoryId,
        itemTypeId: dto.itemTypeId,
        unit: dto.unit?.trim(),
        lowStockLimit:
          dto.lowStockLimit === undefined
            ? undefined
            : this.decimal(dto.lowStockLimit),
        costPrice:
          dto.costPrice === undefined ? undefined : this.decimal(dto.costPrice),
        supplierId: dto.supplierId === undefined ? undefined : dto.supplierId,
        storageLocationId:
          dto.storageLocationId === undefined
            ? undefined
            : dto.storageLocationId,
        trackBatch,
        trackExpiry,
        status: dto.status,
        bottleSizeMl:
          dto.bottleSizeMl === undefined ? undefined : dto.bottleSizeMl,
        itemsPerPacket:
          dto.itemsPerPacket === undefined ? undefined : dto.itemsPerPacket,
      },
      include: this.itemSelectInclude(),
    });

    return this.formatItem(updated);
  }

  async trashItem(id: string, dto: TrashInventoryItemDto) {
    const item = await this.ensureItem(id);
    const reason = dto.reason?.trim();

    if (!reason) {
      throw new BadRequestException('Trash reason is required.');
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const updatedItem = await tx.inventoryItem.update({
        where: { id },
        data: {
          isTrashed: true,
          statusBeforeTrash: item.status,
          status: InventoryItemStatus.Inactive,
          trashedAt: new Date(),
          trashedBy: dto.trashedBy?.trim() || 'Admin',
          trashReason: reason,
        },
        include: this.itemSelectInclude(),
      });

      await tx.inventoryStockMovement.create({
        data: {
          businessId: this.businessId(),
          itemId: item.id,
          supplierId: item.supplierId,
          actionType: InventoryStockActionType.Adjust,
          quantity: this.decimal(0),
          unit: item.unit,
          beforeStock: item.currentStock,
          afterStock: item.currentStock,
          reason: `Moved to trash: ${reason}`,
          performedBy: dto.trashedBy?.trim() || 'Admin',
        },
      });

      return updatedItem;
    });

    return this.formatItem(updated);
  }

  async restoreItem(id: string) {
    const item = await this.ensureItem(id);

    const updated = await this.prisma.$transaction(async (tx) => {
      const restoredItem = await tx.inventoryItem.update({
        where: { id },
        data: {
          isTrashed: false,
          status: item.statusBeforeTrash ?? InventoryItemStatus.Active,
          statusBeforeTrash: null,
          trashedAt: null,
          trashedBy: null,
          trashReason: null,
        },
        include: this.itemSelectInclude(),
      });

      await tx.inventoryStockMovement.create({
        data: {
          businessId: this.businessId(),
          itemId: item.id,
          supplierId: item.supplierId,
          actionType: InventoryStockActionType.Adjust,
          quantity: this.decimal(0),
          unit: item.unit,
          beforeStock: item.currentStock,
          afterStock: item.currentStock,
          reason: 'Restored from trash',
          performedBy: 'Admin',
        },
      });

      return restoredItem;
    });

    return this.formatItem(updated);
  }
  async permanentlyDeleteItem(id: string) {
    const item = await this.prisma.inventoryItem.findFirst({
      where: {
        id,
        businessId: this.businessId(),
      },
    });

    if (!item) {
      throw new NotFoundException('Inventory item not found.');
    }

    if (!item.isTrashed) {
      throw new BadRequestException(
        'Only trashed inventory items can be permanently deleted.',
      );
    }

    const [movementCount, batchCount, recipeCount] = await Promise.all([
      this.prisma.inventoryStockMovement.count({
        where: {
          businessId: this.businessId(),
          itemId: id,
        },
      }),
      this.prisma.inventoryStockBatch.count({
        where: {
          businessId: this.businessId(),
          itemId: id,
        },
      }),
      this.prisma.menuItemRecipeIngredient.count({
        where: {
          businessId: this.businessId(),
          inventoryItemId: id,
        },
      }),
    ]);

    if (movementCount > 0 || batchCount > 0 || recipeCount > 0) {
      throw new BadRequestException(
        'This item has stock history, batches, or recipe mappings and cannot be permanently deleted. Keep it in Trash for audit safety.',
      );
    }

    await this.prisma.inventoryItem.delete({
      where: { id },
    });

    return {
      success: true as const,
      deletedItemId: id,
    };
  }

  async batches(query: InventoryBatchesQueryDto) {
    const batches = await this.prisma.inventoryStockBatch.findMany({
      where: {
        businessId: this.businessId(),
        itemId: query.itemId,
        supplierId: query.supplierId,
        remainingQuantity:
          query.onlyAvailable === 'true' ? { gt: this.decimal(0) } : undefined,
      },
      include: {
        item: {
          select: {
            name: true,
            section: true,
          },
        },
        supplier: {
          select: {
            name: true,
          },
        },
      },
      orderBy: [{ expiryDate: 'asc' }, { purchaseDate: 'asc' }],
    });

    return batches.map((batch) => this.formatBatch(batch));
  }

  async movements(query: InventoryMovementsQueryDto) {
    const actionType = query.actionType
      ? this.toPrismaActionType(query.actionType)
      : undefined;

    const movements = await this.prisma.inventoryStockMovement.findMany({
      where: {
        businessId: this.businessId(),
        itemId: query.itemId,
        actionType,
        item: query.section
          ? {
              section: query.section as InventorySection,
            }
          : undefined,
      },
      include: {
        item: {
          select: {
            name: true,
            section: true,
          },
        },
        supplier: {
          select: {
            name: true,
          },
        },
      },
      orderBy: [{ createdAt: 'desc' }],
      take: 300,
    });

    return movements.map((movement) => this.formatMovement(movement));
  }

  async stockActionReasons(query: InventoryStockActionReasonsQueryDto) {
    const actionType = query.actionType
      ? this.toPrismaActionType(query.actionType)
      : undefined;

    const reasons = await this.prisma.inventoryStockActionReason.findMany({
      where: {
        businessId: this.businessId(),
        actionType,
      },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });

    return reasons.map((reason) => ({
      ...reason,
      actionType: this.toDtoActionType(reason.actionType),
    }));
  }

  async createStockActionReason(dto: CreateInventoryStockActionReasonDto) {
    const name = dto.name?.trim();

    if (!name) {
      throw new BadRequestException('Stock action reason is required.');
    }

    const created = await this.prisma.inventoryStockActionReason.create({
      data: {
        businessId: this.businessId(),
        name,
        actionType: dto.actionType
          ? this.toPrismaActionType(dto.actionType)
          : null,
        sortOrder: dto.sortOrder ?? 0,
      },
    });

    return {
      ...created,
      actionType: this.toDtoActionType(created.actionType),
    };
  }

  async updateStockActionReason(
    id: string,
    dto: UpdateInventoryStockActionReasonDto,
  ) {
    await this.ensureStockActionReason(id);

    const updated = await this.prisma.inventoryStockActionReason.update({
      where: { id },
      data: {
        name: dto.name?.trim(),
        actionType:
          dto.actionType === undefined
            ? undefined
            : dto.actionType === null
              ? null
              : this.toPrismaActionType(dto.actionType),
        sortOrder: dto.sortOrder,
      },
    });

    return {
      ...updated,
      actionType: this.toDtoActionType(updated.actionType),
    };
  }

  async updateStockActionReasonStatus(
    id: string,
    dto: UpdateInventorySettingStatusDto,
  ) {
    await this.ensureStockActionReason(id);

    const updated = await this.prisma.inventoryStockActionReason.update({
      where: { id },
      data: {
        status: dto.status,
      },
    });

    return {
      ...updated,
      actionType: this.toDtoActionType(updated.actionType),
    };
  }
  private async createSupplierPurchaseLedgerEntry(params: {
    tx: Prisma.TransactionClient;
    supplierId: string;
    itemName: string;
    purchaseAmount: number;
    settlementStatus?: 'PaidNow' | 'Credit' | 'Partial';
    paidAmount?: number;
    paymentMethod?: 'Cash' | 'QR' | 'Card';
    supplierBillNo?: string;
    purchaseDate?: string;
    performedBy: string;
  }) {
    const purchaseAmount = this.roundMoney(params.purchaseAmount);

    if (purchaseAmount <= 0) return;

    const settlementStatus = params.settlementStatus ?? 'Credit';
    const paymentMethod = params.paymentMethod ?? 'Cash';

    let paidAmount = this.roundMoney(params.paidAmount ?? 0);

    if (settlementStatus === 'Credit') {
      paidAmount = 0;
    }

    if (settlementStatus === 'PaidNow') {
      paidAmount = purchaseAmount;
    }

    if (settlementStatus === 'Partial') {
      if (paidAmount <= 0) {
        throw new BadRequestException(
          'Paid amount is required for partial supplier payment.',
        );
      }

      if (paidAmount >= purchaseAmount) {
        throw new BadRequestException(
          'For partial payment, paid amount must be less than purchase amount.',
        );
      }
    }

    if (paidAmount > purchaseAmount) {
      throw new BadRequestException(
        'Paid amount cannot be greater than purchase amount.',
      );
    }

    const context = await this.getAccountingContext(params.tx);

    const supplier = await params.tx.ledgerAccount.findFirst({
      where: {
        id: params.supplierId,
        businessId: context.business.id,
        type: 'Supplier',
        isActive: true,
        isArchived: false,
      },
    });

    if (!supplier) {
      throw new BadRequestException('Supplier ledger account was not found.');
    }

    const purchaseReference =
      params.supplierBillNo?.trim() || this.getSupplierPurchaseReference();

    const purchaseEntry = await params.tx.ledgerEntry.create({
      data: {
        businessId: context.business.id,
        branchId: context.branch.id,
        accountId: supplier.id,
        date: params.purchaseDate ? new Date(params.purchaseDate) : new Date(),
        reference: purchaseReference,
        kind: 'SupplierPurchase',
        description: `Inventory purchase: ${params.itemName}`,
        debit: this.decimal(purchaseAmount),
        credit: this.decimal(0),
        handledById: context.actor.id,
        handledByName: params.performedBy || context.actorName,
      },
    });

    if (paidAmount <= 0) return;

    const receiptNumber = this.getSupplierPaymentReceiptNumber();

    const paymentReceipt = await params.tx.paymentReceipt.create({
      data: {
        businessId: context.business.id,
        branchId: context.branch.id,
        terminalId: context.terminal.id,
        receiptNumber,
        source: 'SupplierPayment',
        sourceReference: purchaseReference,
        accountId: supplier.id,
        accountName: supplier.name,
        method: paymentMethod,
        amount: this.decimal(paidAmount),
        receivedAmount:
          paymentMethod === 'Cash' ? this.decimal(paidAmount) : null,
        changeReturn: paymentMethod === 'Cash' ? this.decimal(0) : null,
        status: 'Completed',
        settlementStatus: this.getPaymentSettlementStatus(paymentMethod),
        receivedById: context.actor.id,
        receivedByName: params.performedBy || context.actorName,
        parts: {
          create: [
            {
              method: paymentMethod,
              amount: this.decimal(paidAmount),
            },
          ],
        },
      },
      include: {
        parts: true,
      },
    });

    const paymentEntry = await params.tx.ledgerEntry.create({
      data: {
        businessId: context.business.id,
        branchId: context.branch.id,
        accountId: supplier.id,
        reference: receiptNumber,
        kind: 'Payment',
        description: `Supplier payment for ${params.itemName}`,
        debit: this.decimal(0),
        credit: this.decimal(paidAmount),
        paymentMethod,
        handledById: context.actor.id,
        handledByName: params.performedBy || context.actorName,
        paymentReceiptId: paymentReceipt.id,
      },
    });

    await params.tx.paymentReceipt.update({
      where: { id: paymentReceipt.id },
      data: {
        ledgerEntryId: paymentEntry.id,
      },
    });

    await params.tx.ledgerAllocation.create({
      data: {
        businessId: context.business.id,
        ledgerAccountId: supplier.id,
        paymentEntryId: paymentEntry.id,
        targetEntryId: purchaseEntry.id,
        targetReference: purchaseReference,
        appliedAmount: this.decimal(paidAmount),
      },
    });
  }
  async performStockAction(dto: CreateStockActionDto) {
    const item = await this.ensureItem(dto.itemId);
    const actionType = this.toPrismaActionType(dto.actionType);
    const quantity = this.number(dto.quantity);
    const finalStock = this.number(dto.finalStock);
    const reason = dto.reason?.trim();
    const performedBy = dto.performedBy?.trim() || 'Admin';

    if (!reason) {
      throw new BadRequestException('Reason is required.');
    }

    if (item.isTrashed) {
      throw new BadRequestException('Cannot update stock for trashed item.');
    }

    if (dto.supplierId) {
      await this.ensureSupplier(dto.supplierId);
    }

    if (
      actionType !== InventoryStockActionType.Adjust &&
      actionType !== InventoryStockActionType.Opening &&
      quantity <= 0
    ) {
      throw new BadRequestException('Quantity must be greater than 0.');
    }

    if (
      actionType === InventoryStockActionType.Adjust &&
      !Number.isFinite(Number(dto.finalStock))
    ) {
      throw new BadRequestException('Final stock is required for adjustment.');
    }

    const isStockDecreaseAction =
      actionType === InventoryStockActionType.Reduce ||
      actionType === InventoryStockActionType.Wastage ||
      actionType === InventoryStockActionType.Return;

    if (isStockDecreaseAction && quantity > Number(item.currentStock)) {
      throw new BadRequestException(
        'Quantity cannot be greater than current stock.',
      );
    }

    if (
      actionType === InventoryStockActionType.Add &&
      item.trackExpiry &&
      item.trackBatch &&
      !dto.expiryDate
    ) {
      throw new BadRequestException(
        'Expiry date is required for expiry-tracked stock.',
      );
    }

    const result = await this.prisma.$transaction(async (tx) => {
      const freshItem = await tx.inventoryItem.findFirst({
        where: {
          id: item.id,
          businessId: this.businessId(),
        },
      });

      if (!freshItem) {
        throw new NotFoundException('Inventory item not found.');
      }

      const beforeStock = Number(freshItem.currentStock);
      let afterStock = beforeStock;
      let movementQuantity = quantity;

      if (
        actionType === InventoryStockActionType.Add ||
        actionType === InventoryStockActionType.Opening
      ) {
        afterStock = beforeStock + quantity;
      }

      if (
        actionType === InventoryStockActionType.Reduce ||
        actionType === InventoryStockActionType.Wastage ||
        actionType === InventoryStockActionType.Return
      ) {
        afterStock = beforeStock - quantity;
      }

      if (actionType === InventoryStockActionType.Adjust) {
        afterStock = finalStock;
        movementQuantity = Math.abs(beforeStock - afterStock);
      }

      if (afterStock < 0) {
        throw new BadRequestException('Final stock cannot be negative.');
      }

      const updatedItem = await tx.inventoryItem.update({
        where: { id: freshItem.id },
        data: {
          currentStock: this.decimal(afterStock),
          lastMovementAt: new Date(),
        },
        include: this.itemSelectInclude(),
      });

      if (
        freshItem.trackBatch &&
        (actionType === InventoryStockActionType.Add ||
          actionType === InventoryStockActionType.Opening ||
          (actionType === InventoryStockActionType.Adjust &&
            afterStock > beforeStock))
      ) {
        const addedQuantity =
          actionType === InventoryStockActionType.Adjust
            ? afterStock - beforeStock
            : quantity;

        await tx.inventoryStockBatch.create({
          data: {
            businessId: this.businessId(),
            itemId: freshItem.id,
            supplierId: dto.supplierId || freshItem.supplierId,
            batchNo: dto.batchNo?.trim() || null,
            quantityAdded: this.decimal(addedQuantity),
            remainingQuantity: this.decimal(addedQuantity),
            unit: freshItem.unit,
            costPrice: freshItem.costPrice,
            purchaseDate: new Date(),
            expiryDate: dto.expiryDate ? new Date(dto.expiryDate) : null,
          },
        });
      }

      if (
        freshItem.trackBatch &&
        (actionType === InventoryStockActionType.Reduce ||
          actionType === InventoryStockActionType.Wastage ||
          actionType === InventoryStockActionType.Return ||
          (actionType === InventoryStockActionType.Adjust &&
            afterStock < beforeStock))
      ) {
        const deduction =
          actionType === InventoryStockActionType.Adjust
            ? beforeStock - afterStock
            : quantity;

        await this.deductFromBatches(tx, freshItem.id, deduction, {
          useFefo: freshItem.trackExpiry,
        });
      }

      await tx.inventoryStockMovement.create({
        data: {
          businessId: this.businessId(),
          itemId: freshItem.id,
          supplierId: dto.supplierId || freshItem.supplierId,
          actionType,
          quantity: this.decimal(movementQuantity),
          unit: freshItem.unit,
          beforeStock: this.decimal(beforeStock),
          afterStock: this.decimal(afterStock),
          reason,
          note: dto.note?.trim() || null,
          performedBy,
          batchNo: dto.batchNo?.trim() || null,
          expiryDate: dto.expiryDate ? new Date(dto.expiryDate) : null,
        },
      });

      const supplierId = dto.supplierId || freshItem.supplierId;

      if (
        actionType === InventoryStockActionType.Add &&
        supplierId &&
        this.number(dto.purchaseAmount) > 0
      ) {
        await this.createSupplierPurchaseLedgerEntry({
          tx,
          supplierId,
          itemName: freshItem.name,
          purchaseAmount: this.number(dto.purchaseAmount),
          settlementStatus: dto.settlementStatus,
          paidAmount: dto.paidAmount,
          paymentMethod: dto.paymentMethod,
          supplierBillNo: dto.supplierBillNo,
          purchaseDate: dto.purchaseDate,
          performedBy,
        });
      }

      return updatedItem;
    });

    return this.formatItem(result);
  }
  async recipeIngredients(query: RecipeIngredientsQueryDto) {
    const includeInactive = query.includeInactive === 'true';

    const ingredients = await this.prisma.menuItemRecipeIngredient.findMany({
      where: {
        businessId: this.businessId(),
        menuItemId: query.menuItemId,
        inventoryItemId: query.inventoryItemId,
        isActive: includeInactive ? undefined : true,
      },
      include: {
        menuItem: {
          select: {
            id: true,
            name: true,
            price: true,
            status: true,
          },
        },
        inventoryItem: {
          select: {
            id: true,
            name: true,
            section: true,
            unit: true,
            costPrice: true,
            currentStock: true,
          },
        },
      },
      orderBy: [{ menuItem: { name: 'asc' } }, { sortOrder: 'asc' }],
    });

    return ingredients.map((ingredient) =>
      this.formatRecipeIngredient(ingredient),
    );
  }

  async createRecipeIngredient(dto: CreateRecipeIngredientDto) {
    if (!dto.menuItemId) {
      throw new BadRequestException('Menu item is required.');
    }

    if (!dto.inventoryItemId) {
      throw new BadRequestException('Inventory item is required.');
    }

    if (!dto.unit?.trim()) {
      throw new BadRequestException('Unit is required.');
    }

    if (!Number.isFinite(Number(dto.quantity)) || Number(dto.quantity) <= 0) {
      throw new BadRequestException('Quantity must be greater than 0.');
    }

    await this.ensureMenuItem(dto.menuItemId);
    const inventoryItem = await this.ensureItem(dto.inventoryItemId);

    if (inventoryItem.isTrashed) {
      throw new BadRequestException('Cannot map a trashed inventory item.');
    }

    const existing = await this.prisma.menuItemRecipeIngredient.findFirst({
      where: {
        businessId: this.businessId(),
        menuItemId: dto.menuItemId,
        inventoryItemId: dto.inventoryItemId,
      },
    });

    const saved = existing
      ? await this.prisma.menuItemRecipeIngredient.update({
          where: { id: existing.id },
          data: {
            quantity: this.decimal(dto.quantity),
            unit: dto.unit.trim(),
            wastePercent: this.decimal(dto.wastePercent),
            sortOrder: dto.sortOrder ?? existing.sortOrder,
            isActive: true,
          },
          include: {
            menuItem: {
              select: {
                id: true,
                name: true,
                price: true,
                status: true,
              },
            },
            inventoryItem: {
              select: {
                id: true,
                name: true,
                section: true,
                unit: true,
                costPrice: true,
                currentStock: true,
              },
            },
          },
        })
      : await this.prisma.menuItemRecipeIngredient.create({
          data: {
            businessId: this.businessId(),
            menuItemId: dto.menuItemId,
            inventoryItemId: dto.inventoryItemId,
            quantity: this.decimal(dto.quantity),
            unit: dto.unit.trim(),
            wastePercent: this.decimal(dto.wastePercent),
            sortOrder: dto.sortOrder ?? 0,
            isActive: true,
          },
          include: {
            menuItem: {
              select: {
                id: true,
                name: true,
                price: true,
                status: true,
              },
            },
            inventoryItem: {
              select: {
                id: true,
                name: true,
                section: true,
                unit: true,
                costPrice: true,
                currentStock: true,
              },
            },
          },
        });

    return this.formatRecipeIngredient(saved);
  }

  async updateRecipeIngredient(id: string, dto: UpdateRecipeIngredientDto) {
    const existing = await this.ensureRecipeIngredient(id);

    if (dto.inventoryItemId) {
      const inventoryItem = await this.ensureItem(dto.inventoryItemId);

      if (inventoryItem.isTrashed) {
        throw new BadRequestException('Cannot map a trashed inventory item.');
      }
    }

    if (
      dto.quantity !== undefined &&
      (!Number.isFinite(Number(dto.quantity)) || Number(dto.quantity) <= 0)
    ) {
      throw new BadRequestException('Quantity must be greater than 0.');
    }

    const updated = await this.prisma.menuItemRecipeIngredient.update({
      where: { id: existing.id },
      data: {
        inventoryItemId: dto.inventoryItemId,
        quantity:
          dto.quantity === undefined ? undefined : this.decimal(dto.quantity),
        unit: dto.unit?.trim(),
        wastePercent:
          dto.wastePercent === undefined
            ? undefined
            : this.decimal(dto.wastePercent),
        sortOrder: dto.sortOrder,
        isActive: dto.isActive,
      },
      include: {
        menuItem: {
          select: {
            id: true,
            name: true,
            price: true,
            status: true,
          },
        },
        inventoryItem: {
          select: {
            id: true,
            name: true,
            section: true,
            unit: true,
            costPrice: true,
            currentStock: true,
          },
        },
      },
    });

    return this.formatRecipeIngredient(updated);
  }

  async deleteRecipeIngredient(id: string) {
    const existing = await this.ensureRecipeIngredient(id);

    const updated = await this.prisma.menuItemRecipeIngredient.update({
      where: { id: existing.id },
      data: {
        isActive: false,
      },
      include: {
        menuItem: {
          select: {
            id: true,
            name: true,
            price: true,
            status: true,
          },
        },
        inventoryItem: {
          select: {
            id: true,
            name: true,
            section: true,
            unit: true,
            costPrice: true,
            currentStock: true,
          },
        },
      },
    });

    return this.formatRecipeIngredient(updated);
  }

  private async deductFromBatches(
    tx: Prisma.TransactionClient,
    itemId: string,
    quantityToDeduct: number,
    options: { useFefo: boolean },
  ) {
    let remaining = quantityToDeduct;

    const batches = await tx.inventoryStockBatch.findMany({
      where: {
        businessId: this.businessId(),
        itemId,
        remainingQuantity: {
          gt: this.decimal(0),
        },
      },
      orderBy: options.useFefo
        ? [{ expiryDate: 'asc' }, { purchaseDate: 'asc' }]
        : [{ purchaseDate: 'asc' }],
    });

    for (const batch of batches) {
      if (remaining <= 0) break;

      const batchRemaining = Number(batch.remainingQuantity);
      const consume = Math.min(batchRemaining, remaining);
      const nextRemaining = batchRemaining - consume;

      await tx.inventoryStockBatch.update({
        where: { id: batch.id },
        data: {
          remainingQuantity: this.decimal(nextRemaining),
        },
      });

      remaining -= consume;
    }

    if (remaining > 0.0001) {
      throw new BadRequestException(
        'Not enough available batch quantity to complete this action.',
      );
    }
  }

  private async ensureCategory(id: string) {
    const item = await this.prisma.inventoryCategory.findFirst({
      where: { id, businessId: this.businessId() },
    });

    if (!item) {
      throw new NotFoundException('Inventory category not found.');
    }

    return item;
  }

  private async ensureItemType(id: string) {
    const item = await this.prisma.inventoryItemType.findFirst({
      where: { id, businessId: this.businessId() },
    });

    if (!item) {
      throw new NotFoundException('Inventory item type not found.');
    }

    return item;
  }

  private async ensureLocation(id: string) {
    const item = await this.prisma.inventoryLocation.findFirst({
      where: { id, businessId: this.businessId() },
    });

    if (!item) {
      throw new NotFoundException('Inventory location not found.');
    }

    return item;
  }

  private async ensureSupplier(id: string) {
    const supplier = await this.prisma.ledgerAccount.findFirst({
      where: {
        id,
        businessId: this.businessId(),
        type: 'Supplier',
        isActive: true,
        isArchived: false,
      },
    });

    if (!supplier) {
      throw new BadRequestException(
        'Supplier account must be created in Ledger before using it in Inventory.',
      );
    }

    return supplier;
  }

  private async ensureStockActionReason(id: string) {
    const item = await this.prisma.inventoryStockActionReason.findFirst({
      where: { id, businessId: this.businessId() },
    });

    if (!item) {
      throw new NotFoundException('Stock action reason not found.');
    }

    return item;
  }
  private async ensureMenuItem(id: string) {
    const item = await this.prisma.menuItem.findFirst({
      where: {
        id,
        businessId: this.businessId(),
        isTrashed: false,
      },
    });

    if (!item) {
      throw new NotFoundException('Menu item not found.');
    }

    return item;
  }

  private async ensureRecipeIngredient(id: string) {
    const item = await this.prisma.menuItemRecipeIngredient.findFirst({
      where: {
        id,
        businessId: this.businessId(),
      },
    });

    if (!item) {
      throw new NotFoundException('Recipe ingredient not found.');
    }

    return item;
  }
  private async ensureItem(id: string) {
    const item = await this.prisma.inventoryItem.findFirst({
      where: { id, businessId: this.businessId() },
    });

    if (!item) {
      throw new NotFoundException('Inventory item not found.');
    }

    return item;
  }
}
