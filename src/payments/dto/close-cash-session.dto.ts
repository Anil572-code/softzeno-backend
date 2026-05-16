import { IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class CloseCashSessionDto {
  @IsNumber()
  @Min(0)
  countedCash!: number;

  @IsOptional()
  @IsString()
  closeNote?: string;

  @IsOptional()
  @IsString()
  closedById?: string;

  @IsOptional()
  @IsString()
  closedByName?: string;
}
