import { IsArray, IsOptional, IsString } from 'class-validator';

export class SendKotDto {
  @IsArray()
  @IsString({ each: true })
  itemIds!: string[];

  @IsOptional()
  @IsString()
  destination?: string;

  @IsOptional()
  @IsString()
  sentById?: string;

  @IsOptional()
  @IsString()
  sentByName?: string;
}
