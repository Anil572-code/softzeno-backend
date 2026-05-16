import {
  IsArray,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class FinalizeInvoiceItemDto {
  @IsString()
  id!: string;

  @IsOptional()
  @IsString()
  menuItemId?: string;

  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  category?: string;

  @IsNumber()
  @Min(0.01)
  qty!: number;

  @IsNumber()
  @Min(0)
  rate!: number;

  @IsOptional()
  @IsString()
  kotNumber?: string;
}

export class FinalizeInvoicePaymentDto {
  @IsIn(['Cash', 'QR', 'Card'])
  method!: 'Cash' | 'QR' | 'Card';

  @IsNumber()
  @Min(0.01)
  amount!: number;

  @IsOptional()
  @IsString()
  provider?: string;

  @IsOptional()
  @IsString()
  referenceNumber?: string;

  @IsOptional()
  @IsString()
  bankName?: string;
}

export class FinalizeInvoiceCreditDto {
  @IsIn(['Customer', 'Staff'])
  accountType!: 'Customer' | 'Staff';

  @IsString()
  accountName!: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsNumber()
  @Min(0.01)
  amount!: number;

  @IsOptional()
  @IsString()
  dueDate?: string;

  @IsOptional()
  @IsString()
  note?: string;
}

export class FinalizeInvoiceDto {
  @IsString()
  orderId!: string;

  @IsString()
  orderNumber!: string;

  @IsOptional()
  @IsString()
  tableId?: string;

  @IsOptional()
  @IsString()
  tableName?: string;

  @IsOptional()
  @IsString()
  customerName?: string;

  @IsOptional()
  @IsString()
  customerPhone?: string;

  @IsOptional()
  @IsString()
  customerPanVat?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => FinalizeInvoiceItemDto)
  items!: FinalizeInvoiceItemDto[];

  @IsOptional()
  @IsNumber()
  @Min(0)
  discountAmount?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  vatRate?: number;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => FinalizeInvoicePaymentDto)
  payments?: FinalizeInvoicePaymentDto[];

  @IsOptional()
  @ValidateNested()
  @Type(() => FinalizeInvoiceCreditDto)
  credit?: FinalizeInvoiceCreditDto;
}
