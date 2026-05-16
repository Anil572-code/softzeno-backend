import { IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class OpenCashSessionDto {
  @IsNumber()
  @Min(0)
  openingCash!: number;

  @IsOptional()
  @IsString()
  terminalCode?: string;

  @IsOptional()
  @IsString()
  openedById?: string;

  @IsOptional()
  @IsString()
  openedByName?: string;
}
