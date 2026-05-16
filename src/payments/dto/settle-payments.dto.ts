import {
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsOptional,
  IsString,
} from 'class-validator';

export class SettlePaymentsDto {
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  paymentIds!: string[];

  @IsString()
  settlementReference!: string;

  @IsOptional()
  @IsString()
  settlementBatchId?: string;

  @IsOptional()
  @IsString()
  bankName?: string;

  @IsOptional()
  @IsDateString()
  settledAt?: string;

  @IsOptional()
  @IsString()
  settledById?: string;

  @IsOptional()
  @IsString()
  settledByName?: string;

  @IsOptional()
  @IsString()
  note?: string;
}
