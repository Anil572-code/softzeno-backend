import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { CreateMenuCategoryDto } from './dto/create-menu-category.dto';
import { CreateMenuItemDto } from './dto/create-menu-item.dto';
import { CreateMenuSectionDto } from './dto/create-menu-section.dto';
import { CreateMenuTypeDto } from './dto/create-menu-type.dto';
import { UpdateMenuCategoryDto } from './dto/update-menu-category.dto';
import { UpdateMenuItemDto } from './dto/update-menu-item.dto';
import { UpdateMenuItemStatusDto } from './dto/update-menu-item-status.dto';
import { UpdateMenuSectionDto } from './dto/update-menu-section.dto';
import { UpdateMenuTypeDto } from './dto/update-menu-type.dto';
import { MenuService } from './menu.service';

@Controller('menu')
export class MenuController {
  constructor(private readonly menuService: MenuService) {}

  @Get('sections')
  getSections(
    @Query('businessId') businessId?: string,
    @Query('includeInactive') includeInactive?: string,
  ) {
    return this.menuService.getSections({
      businessId,
      includeInactive: includeInactive === 'true',
    });
  }

  @Post('sections')
  createSection(@Body() dto: CreateMenuSectionDto) {
    return this.menuService.createSection(dto);
  }

  @Patch('sections/:id')
  updateSection(@Param('id') id: string, @Body() dto: UpdateMenuSectionDto) {
    return this.menuService.updateSection(id, dto);
  }

  @Get('categories')
  getCategories(
    @Query('businessId') businessId?: string,
    @Query('sectionId') sectionId?: string,
    @Query('includeInactive') includeInactive?: string,
  ) {
    return this.menuService.getCategories({
      businessId,
      sectionId,
      includeInactive: includeInactive === 'true',
    });
  }

  @Post('categories')
  createCategory(@Body() dto: CreateMenuCategoryDto) {
    return this.menuService.createCategory(dto);
  }

  @Patch('categories/:id')
  updateCategory(@Param('id') id: string, @Body() dto: UpdateMenuCategoryDto) {
    return this.menuService.updateCategory(id, dto);
  }

  @Get('types')
  getTypes(
    @Query('businessId') businessId?: string,
    @Query('sectionId') sectionId?: string,
    @Query('categoryId') categoryId?: string,
    @Query('includeInactive') includeInactive?: string,
  ) {
    return this.menuService.getTypes({
      businessId,
      sectionId,
      categoryId,
      includeInactive: includeInactive === 'true',
    });
  }

  @Post('types')
  createType(@Body() dto: CreateMenuTypeDto) {
    return this.menuService.createType(dto);
  }

  @Patch('types/:id')
  updateType(@Param('id') id: string, @Body() dto: UpdateMenuTypeDto) {
    return this.menuService.updateType(id, dto);
  }

  @Get('items')
  getItems(
    @Query('businessId') businessId?: string,
    @Query('includeUnavailable') includeUnavailable?: string,
    @Query('includeHidden') includeHidden?: string,
    @Query('sectionId') sectionId?: string,
    @Query('categoryId') categoryId?: string,
    @Query('typeId') typeId?: string,
  ) {
    return this.menuService.getItems({
      businessId,
      includeUnavailable: includeUnavailable === 'true',
      includeHidden: includeHidden === 'true',
      sectionId,
      categoryId,
      typeId,
    });
  }

  @Post('items')
  createItem(@Body() dto: CreateMenuItemDto) {
    return this.menuService.createItem(dto);
  }

  @Patch('items/:id')
  updateItem(@Param('id') id: string, @Body() dto: UpdateMenuItemDto) {
    return this.menuService.updateItem(id, dto);
  }

  @Patch('items/:id/status')
  updateItemStatus(
    @Param('id') id: string,
    @Body() dto: UpdateMenuItemStatusDto,
  ) {
    return this.menuService.updateItemStatus(id, dto);
  }

  @Delete('items/:id')
  deleteItem(@Param('id') id: string) {
    return this.menuService.deleteItem(id);
  }
}
