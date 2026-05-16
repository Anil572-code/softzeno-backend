import type {
  InventoryItemStatus,
  InventorySection,
  InventorySettingStatus,
} from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

export class CreateInventoryCategoryDto {
  @IsEnum(['Kitchen', 'Bar'])
  section!: InventorySection;

  @IsString()
  name!: string;

  @IsOptional()
  @IsNumber()
  sortOrder?: number;
}

export class UpdateInventoryCategoryDto {
  section?: InventorySection;
  name?: string;
  sortOrder?: number;
}

export class UpdateInventorySettingStatusDto {
  status!: InventorySettingStatus;
}

export class CreateInventoryItemTypeDto {
  @IsString()
  name!: string;

  @IsOptional()
  @IsNumber()
  sortOrder?: number;
}

export class UpdateInventoryItemTypeDto {
  name?: string;
  sortOrder?: number;
}

export class CreateInventoryLocationDto {
  @IsString()
  name!: string;
}

export class UpdateInventoryLocationDto {
  name?: string;
}

export class CreateInventorySupplierDto {
  name!: string;
  phone?: string;
  address?: string;
  payableAmount?: number;
  paymentStatus?: string;
}

export class UpdateInventorySupplierDto {
  name?: string;
  phone?: string;
  address?: string;
  payableAmount?: number;
  paymentStatus?: string;
}

export class CreateInventoryItemDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsEnum(['Kitchen', 'Bar'])
  section!: InventorySection;

  @IsString()
  @IsNotEmpty()
  categoryId!: string;

  @IsString()
  @IsNotEmpty()
  itemTypeId!: string;

  @IsString()
  @IsNotEmpty()
  unit!: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  openingStock?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  lowStockLimit?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  costPrice?: number;

  @IsOptional()
  @IsString()
  supplierId?: string;

  @IsOptional()
  @IsString()
  storageLocationId?: string;

  @IsOptional()
  @IsBoolean()
  trackBatch?: boolean;

  @IsOptional()
  @IsBoolean()
  trackExpiry?: boolean;

  @IsOptional()
  @IsEnum(['Active', 'Inactive'])
  status?: InventoryItemStatus;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  bottleSizeMl?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  itemsPerPacket?: number;
}

export class UpdateInventoryItemDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  name?: string;

  @IsOptional()
  @IsEnum(['Kitchen', 'Bar'])
  section?: InventorySection;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  categoryId?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  itemTypeId?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  unit?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  lowStockLimit?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  costPrice?: number;

  @IsOptional()
  @IsString()
  supplierId?: string | null;

  @IsOptional()
  @IsString()
  storageLocationId?: string | null;

  @IsOptional()
  @IsBoolean()
  trackBatch?: boolean;

  @IsOptional()
  @IsBoolean()
  trackExpiry?: boolean;

  @IsOptional()
  @IsEnum(['Active', 'Inactive'])
  status?: InventoryItemStatus;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  bottleSizeMl?: number | null;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  itemsPerPacket?: number | null;
}

export class TrashInventoryItemDto {
  @IsString()
  @IsNotEmpty()
  reason!: string;

  @IsOptional()
  @IsString()
  trashedBy?: string;
}

export enum InventoryStockActionDtoType {
  Add = 'add',
  Reduce = 'reduce',
  Wastage = 'wastage',
  Adjust = 'adjust',
  Return = 'return',
  Opening = 'opening',
}

export class CreateStockActionDto {
  @IsString()
  @IsNotEmpty()
  itemId!: string;

  @IsEnum(InventoryStockActionDtoType)
  actionType!: InventoryStockActionDtoType;

  @IsNumber()
  @Min(0)
  quantity!: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  finalStock?: number;

  @IsString()
  @IsNotEmpty()
  reason!: string;

  @IsOptional()
  @IsString()
  note?: string;

  @IsOptional()
  @IsString()
  supplierId?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  purchaseAmount?: number;

  @IsOptional()
  @IsEnum(['PaidNow', 'Credit', 'Partial'])
  settlementStatus?: 'PaidNow' | 'Credit' | 'Partial';

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  paidAmount?: number;

  @IsOptional()
  @IsEnum(['Cash', 'QR', 'Card'])
  paymentMethod?: 'Cash' | 'QR' | 'Card';

  @IsOptional()
  @IsString()
  supplierBillNo?: string;

  @IsOptional()
  @IsDateString()
  purchaseDate?: string;

  @IsOptional()
  @IsString()
  batchNo?: string;

  @IsOptional()
  @IsDateString()
  expiryDate?: string;

  @IsOptional()
  @IsString()
  performedBy?: string;
}

export class InventoryMovementsQueryDto {
  @IsOptional()
  @IsString()
  itemId?: string;

  @IsOptional()
  @IsEnum(InventoryStockActionDtoType)
  actionType?: InventoryStockActionDtoType;

  @IsOptional()
  @IsString()
  section?: string;
}

export class InventoryBatchesQueryDto {
  @IsOptional()
  @IsString()
  itemId?: string;

  @IsOptional()
  @IsString()
  supplierId?: string;

  @IsOptional()
  @IsString()
  onlyAvailable?: string;
}

export class InventoryStockActionReasonsQueryDto {
  @IsOptional()
  @IsEnum(InventoryStockActionDtoType)
  actionType?: InventoryStockActionDtoType;
}

export class CreateInventoryStockActionReasonDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsOptional()
  @IsEnum(InventoryStockActionDtoType)
  actionType?: InventoryStockActionDtoType;

  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;
}

export class UpdateInventoryStockActionReasonDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  name?: string;

  @IsOptional()
  @IsEnum(InventoryStockActionDtoType)
  actionType?: InventoryStockActionDtoType | null;

  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;
}
export class CreateRecipeIngredientDto {
  @IsString()
  @IsNotEmpty()
  menuItemId!: string;

  @IsString()
  @IsNotEmpty()
  inventoryItemId!: string;

  @IsNumber()
  @Min(0.0001)
  quantity!: number;

  @IsString()
  @IsNotEmpty()
  unit!: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  wastePercent?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;
}

export class UpdateRecipeIngredientDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  inventoryItemId?: string;

  @IsOptional()
  @IsNumber()
  @Min(0.0001)
  quantity?: number;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  unit?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  wastePercent?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;

  @IsOptional()
  isActive?: boolean;
}

export class RecipeIngredientsQueryDto {
  @IsOptional()
  @IsString()
  menuItemId?: string;

  @IsOptional()
  @IsString()
  inventoryItemId?: string;

  @IsOptional()
  @IsString()
  includeInactive?: string;
}
