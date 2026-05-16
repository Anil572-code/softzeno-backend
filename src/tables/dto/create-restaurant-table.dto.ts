import {
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

export class CreateRestaurantTableDto {
  @IsString()
  areaId!: string;

  @IsString()
  name!: string;

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
  reservationName?: string;

  @IsOptional()
  @IsString()
  reservationPhone?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  reservationGuests?: number;

  @IsOptional()
  @IsString()
  reservationTime?: string;

  @IsOptional()
  @IsString()
  reservationNote?: string;
}
