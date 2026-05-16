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

export class LedgerPaymentAllocationDto {
  @IsString()
  targetEntryId: string;

  @IsNumber()
  @Min(0.01)
  amount: number;
}

export class CollectLedgerPaymentDto {
  @IsString()
  accountId: string;

  @IsNumber()
  @Min(0.01)
  amount: number;

  @IsIn(['Cash', 'QR', 'Card'])
  method: 'Cash' | 'QR' | 'Card';

  @IsOptional()
  @IsString()
  provider?: string;

  @IsOptional()
  @IsString()
  referenceNumber?: string;

  @IsOptional()
  @IsString()
  bankName?: string;

  @IsOptional()
  @IsString()
  note?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => LedgerPaymentAllocationDto)
  allocations: LedgerPaymentAllocationDto[];
}
