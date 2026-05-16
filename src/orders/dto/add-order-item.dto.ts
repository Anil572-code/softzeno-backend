import { IsNumber, IsOptional, IsPositive, IsString } from 'class-validator';

export class AddOrderItemDto {
  @IsOptional()
  @IsString()
  menuItemId?: string;

  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsString()
  section?: string;

  @IsOptional()
  @IsString()
  typeName?: string;

  @IsOptional()
  @IsString()
  kotDestination?: string;

  @IsNumber()
  @IsPositive()
  qty!: number;

  @IsNumber()
  @IsPositive()
  rate!: number;

  @IsOptional()
  @IsString()
  note?: string;
}
