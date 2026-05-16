import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';

export class CanvasSizeDto {
  @IsIn(['square', 'standard', 'wide', 'tall', 'custom'])
  type!: string;

  @IsInt()
  @Min(1)
  width!: number;

  @IsInt()
  @Min(1)
  height!: number;
}

export class FloorTableDto {
  @IsOptional()
  @IsString()
  id?: string;

  @IsString()
  name!: string;

  @IsInt()
  @Min(1)
  seats!: number;

  @IsIn(['round', 'square', 'rectangle'])
  shape!: string;

  @IsIn(['Free', 'Occupied', 'Reserved', 'free', 'occupied', 'reserved'])
  status!: string;

  @IsNumber()
  x!: number;

  @IsNumber()
  y!: number;

  @IsNumber()
  width!: number;

  @IsNumber()
  height!: number;
}

export class FloorBlockDto {
  @IsOptional()
  @IsString()
  id?: string;

  @IsString()
  label!: string;

  @IsIn([
    'wall',
    'pillar',
    'counter',
    'cashier',
    'kitchen',
    'bar',
    'door',
    'washroom',
    'service',
    'waiting',
    'plant',
    'custom',
  ])
  blockType!: string;

  @IsString()
  color!: string;

  @IsBoolean()
  showLabel!: boolean;

  @IsNumber()
  x!: number;

  @IsNumber()
  y!: number;

  @IsNumber()
  width!: number;

  @IsNumber()
  height!: number;
}

export class FloorZoneDto {
  @IsOptional()
  @IsString()
  id?: string;

  @IsString()
  name!: string;

  @IsString()
  color!: string;

  @IsOptional()
  @IsNumber()
  opacity?: number;

  @IsBoolean()
  showLabel!: boolean;

  @IsNumber()
  x!: number;

  @IsNumber()
  y!: number;

  @IsNumber()
  width!: number;

  @IsNumber()
  height!: number;
}

export class FloorLineDto {
  @IsOptional()
  @IsString()
  id?: string;

  @IsNumber()
  x1!: number;

  @IsNumber()
  y1!: number;

  @IsNumber()
  x2!: number;

  @IsNumber()
  y2!: number;

  @IsInt()
  @Min(1)
  thickness!: number;

  @IsString()
  color!: string;

  @IsIn(['solid', 'dashed', 'dotted'])
  style!: string;
}

export class FloorTextDto {
  @IsOptional()
  @IsString()
  id?: string;

  @IsString()
  text!: string;

  @IsString()
  color!: string;

  @IsInt()
  @Min(1)
  fontSize!: number;

  @IsIn(['normal', 'bold', 'black'])
  fontWeight!: string;

  @IsIn(['left', 'center', 'right'])
  align!: string;

  @IsBoolean()
  background!: boolean;

  @IsNumber()
  x!: number;

  @IsNumber()
  y!: number;

  @IsNumber()
  width!: number;

  @IsNumber()
  height!: number;
}

export class SaveFloorLayoutDto {
  @ValidateNested()
  @Type(() => CanvasSizeDto)
  canvasSize!: CanvasSizeDto;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => FloorTableDto)
  tables!: FloorTableDto[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => FloorBlockDto)
  blocks!: FloorBlockDto[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => FloorZoneDto)
  zones!: FloorZoneDto[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => FloorLineDto)
  lines!: FloorLineDto[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => FloorTextDto)
  texts!: FloorTextDto[];
}
