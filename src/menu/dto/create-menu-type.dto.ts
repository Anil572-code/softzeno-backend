import { IsBoolean, IsInt, IsOptional, IsString, Min } from 'class-validator';

export class CreateMenuTypeDto {
  @IsOptional()
  @IsString()
  businessId?: string;

  @IsString()
  sectionId!: string;

  @IsString()
  categoryId!: string;

  @IsString()
  name!: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
