import { IsNumber, IsOptional, IsPositive, IsString } from 'class-validator';

export class VoidOrderItemDto {
  @IsString()
  reason!: string;

  @IsOptional()
  @IsString()
  note?: string;

  @IsOptional()
  @IsNumber()
  @IsPositive()
  quantity?: number;

  @IsOptional()
  @IsString()
  voidedById?: string;

  @IsOptional()
  @IsString()
  voidedByName?: string;
}
