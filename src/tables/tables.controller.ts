import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Query,
} from '@nestjs/common';

import { CreateRestaurantTableDto } from './dto/create-restaurant-table.dto';
import { CreateTableAreaDto } from './dto/create-table-area.dto';
import { SaveFloorLayoutDto } from './dto/save-floor-layout.dto';
import { UpdateRestaurantTableDto } from './dto/update-restaurant-table.dto';
import { UpdateTableAreaDto } from './dto/update-table-area.dto';
import { TablesService } from './tables.service';

@Controller('tables')
export class TablesController {
  constructor(private readonly tablesService: TablesService) {}

  @Get('areas')
  getAreas(@Query('includeInactive') includeInactive?: string) {
    return this.tablesService.getAreas(includeInactive === 'true');
  }

  @Post('areas')
  createArea(@Body() payload: CreateTableAreaDto) {
    return this.tablesService.createArea(payload);
  }

  @Patch('areas/:id')
  updateArea(@Param('id') id: string, @Body() payload: UpdateTableAreaDto) {
    return this.tablesService.updateArea(id, payload);
  }

  @Delete('areas/:id')
  deleteArea(@Param('id') id: string) {
    return this.tablesService.deleteArea(id);
  }

  @Get('layout/:areaId')
  getFloorLayout(@Param('areaId') areaId: string) {
    return this.tablesService.getFloorLayout(areaId);
  }

  @Put('layout/:areaId')
  saveFloorLayout(
    @Param('areaId') areaId: string,
    @Body() payload: SaveFloorLayoutDto,
  ) {
    return this.tablesService.saveFloorLayout(areaId, payload);
  }

  @Get()
  getTables() {
    return this.tablesService.getTables();
  }

  @Post()
  createTable(@Body() payload: CreateRestaurantTableDto) {
    return this.tablesService.createTable(payload);
  }

  @Patch(':id')
  updateTable(
    @Param('id') id: string,
    @Body() payload: UpdateRestaurantTableDto,
  ) {
    return this.tablesService.updateTable(id, payload);
  }

  @Delete(':id')
  deleteTable(@Param('id') id: string) {
    return this.tablesService.deleteTable(id);
  }
}
