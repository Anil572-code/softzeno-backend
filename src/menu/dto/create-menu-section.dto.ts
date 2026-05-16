import { IsBoolean, IsInt, IsOptional, IsString, Min } from 'class-validator';

export class CreateMenuSectionDto {
  @IsOptional()
  @IsString()
  businessId?: string;

  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  kotDestination?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
