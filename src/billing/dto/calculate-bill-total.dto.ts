import {
  IsArray,
  IsBoolean,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CalculateBillItemDto {
  @IsString()
  id: string;

  @IsString()
  name: string;

  @IsNumber()
  @Min(0.01)
  qty: number;

  @IsNumber()
  @Min(0)
  rate: number;

  @IsOptional()
  @IsBoolean()
  voided?: boolean;
}

export class CalculateBillTotalDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CalculateBillItemDto)
  items: CalculateBillItemDto[];

  @IsOptional()
  @IsNumber()
  @Min(0)
  discountAmount?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  vatRate?: number;
}
