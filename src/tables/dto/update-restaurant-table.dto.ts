import {
  IsBoolean,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

export class UpdateRestaurantTableDto {
  @IsOptional()
  @IsString()
  areaId?: string;

  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  seats?: number;

  @IsOptional()
  @IsIn(['round', 'square', 'rectangle'])
  shape?: string;

  @IsOptional()
  @IsIn(['Free', 'Occupied', 'Reserved', 'free', 'occupied', 'reserved'])
  status?: string;

  @IsOptional()
  @IsNumber()
  x?: number;

  @IsOptional()
  @IsNumber()
  y?: number;

  @IsOptional()
  @IsNumber()
  width?: number;

  @IsOptional()
  @IsNumber()
  height?: number;

  @IsOptional()
  @IsString()
  activeOrderId?: string | null;

  @IsOptional()
  @IsString()
  activeOrderNumber?: string | null;

  @IsOptional()
  @IsInt()
  currentGuests?: number | null;

  @IsOptional()
  @IsNumber()
  currentAmount?: number | null;

  @IsOptional()
  @IsString()
  reservationName?: string | null;

  @IsOptional()
  @IsString()
  reservationPhone?: string | null;

  @IsOptional()
  @IsInt()
  reservationGuests?: number | null;

  @IsOptional()
  @IsString()
  reservationTime?: string | null;

  @IsOptional()
  @IsString()
  reservationNote?: string | null;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
