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

import {
  CreateInventoryCategoryDto,
  CreateRecipeIngredientDto,
  RecipeIngredientsQueryDto,
  UpdateRecipeIngredientDto,
  CreateInventoryItemDto,
  CreateInventoryItemTypeDto,
  CreateInventoryLocationDto,
  CreateInventoryStockActionReasonDto,
  CreateInventorySupplierDto,
  CreateStockActionDto,
  InventoryBatchesQueryDto,
  InventoryMovementsQueryDto,
  InventoryStockActionReasonsQueryDto,
  TrashInventoryItemDto,
  UpdateInventoryCategoryDto,
  UpdateInventoryItemDto,
  UpdateInventoryItemTypeDto,
  UpdateInventoryLocationDto,
  UpdateInventorySettingStatusDto,
  UpdateInventoryStockActionReasonDto,
  UpdateInventorySupplierDto,
} from './dto/inventory.dto';
import { InventoryService } from './inventory.service';

@Controller('inventory')
export class InventoryController {
  constructor(private readonly inventoryService: InventoryService) {}

  @Get('categories')
  categories() {
    return this.inventoryService.categories();
  }

  @Post('categories')
  createCategory(@Body() dto: CreateInventoryCategoryDto) {
    return this.inventoryService.createCategory(dto);
  }

  @Patch('categories/:id')
  updateCategory(
    @Param('id') id: string,
    @Body() dto: UpdateInventoryCategoryDto,
  ) {
    return this.inventoryService.updateCategory(id, dto);
  }

  @Patch('categories/:id/status')
  updateCategoryStatus(
    @Param('id') id: string,
    @Body() dto: UpdateInventorySettingStatusDto,
  ) {
    return this.inventoryService.updateCategoryStatus(id, dto);
  }

  @Get('item-types')
  itemTypes() {
    return this.inventoryService.itemTypes();
  }

  @Post('item-types')
  createItemType(@Body() dto: CreateInventoryItemTypeDto) {
    return this.inventoryService.createItemType(dto);
  }

  @Patch('item-types/:id')
  updateItemType(
    @Param('id') id: string,
    @Body() dto: UpdateInventoryItemTypeDto,
  ) {
    return this.inventoryService.updateItemType(id, dto);
  }

  @Patch('item-types/:id/status')
  updateItemTypeStatus(
    @Param('id') id: string,
    @Body() dto: UpdateInventorySettingStatusDto,
  ) {
    return this.inventoryService.updateItemTypeStatus(id, dto);
  }

  @Get('locations')
  locations() {
    return this.inventoryService.locations();
  }

  @Post('locations')
  createLocation(@Body() dto: CreateInventoryLocationDto) {
    return this.inventoryService.createLocation(dto);
  }

  @Patch('locations/:id')
  updateLocation(
    @Param('id') id: string,
    @Body() dto: UpdateInventoryLocationDto,
  ) {
    return this.inventoryService.updateLocation(id, dto);
  }

  @Patch('locations/:id/status')
  updateLocationStatus(
    @Param('id') id: string,
    @Body() dto: UpdateInventorySettingStatusDto,
  ) {
    return this.inventoryService.updateLocationStatus(id, dto);
  }

  @Get('suppliers')
  suppliers() {
    return this.inventoryService.suppliers();
  }

  @Post('suppliers')
  createSupplier(@Body() dto: CreateInventorySupplierDto) {
    return this.inventoryService.createSupplier(dto);
  }

  @Patch('suppliers/:id')
  updateSupplier(
    @Param('id') id: string,
    @Body() dto: UpdateInventorySupplierDto,
  ) {
    return this.inventoryService.updateSupplier(id, dto);
  }

  @Patch('suppliers/:id/status')
  updateSupplierStatus(
    @Param('id') id: string,
    @Body() dto: UpdateInventorySettingStatusDto,
  ) {
    return this.inventoryService.updateSupplierStatus(id, dto);
  }

  @Get('batches')
  batches(@Query() query: InventoryBatchesQueryDto) {
    return this.inventoryService.batches(query);
  }

  @Get('movements')
  movements(@Query() query: InventoryMovementsQueryDto) {
    return this.inventoryService.movements(query);
  }

  @Get('stock-action-reasons')
  stockActionReasons(@Query() query: InventoryStockActionReasonsQueryDto) {
    return this.inventoryService.stockActionReasons(query);
  }

  @Post('stock-action-reasons')
  createStockActionReason(@Body() dto: CreateInventoryStockActionReasonDto) {
    return this.inventoryService.createStockActionReason(dto);
  }

  @Patch('stock-action-reasons/:id')
  updateStockActionReason(
    @Param('id') id: string,
    @Body() dto: UpdateInventoryStockActionReasonDto,
  ) {
    return this.inventoryService.updateStockActionReason(id, dto);
  }

  @Patch('stock-action-reasons/:id/status')
  updateStockActionReasonStatus(
    @Param('id') id: string,
    @Body() dto: UpdateInventorySettingStatusDto,
  ) {
    return this.inventoryService.updateStockActionReasonStatus(id, dto);
  }

  @Post('stock-actions')
  performStockAction(@Body() dto: CreateStockActionDto) {
    return this.inventoryService.performStockAction(dto);
  }

  @Get('items')
  items(
    @Query('section') section?: 'Kitchen' | 'Bar',
    @Query('includeTrashed') includeTrashed?: string,
    @Query('stockStatus')
    stockStatus?: 'In Stock' | 'Low Stock' | 'Out of Stock',
  ) {
    return this.inventoryService.items({
      section,
      includeTrashed,
      stockStatus,
    });
  }

  @Post('items')
  createItem(@Body() dto: CreateInventoryItemDto) {
    return this.inventoryService.createItem(dto);
  }

  @Get('items/:id')
  item(@Param('id') id: string) {
    return this.inventoryService.item(id);
  }
  @Get('recipe-ingredients')
  recipeIngredients(@Query() query: RecipeIngredientsQueryDto) {
    return this.inventoryService.recipeIngredients(query);
  }

  @Post('recipe-ingredients')
  createRecipeIngredient(@Body() dto: CreateRecipeIngredientDto) {
    return this.inventoryService.createRecipeIngredient(dto);
  }

  @Patch('recipe-ingredients/:id')
  updateRecipeIngredient(
    @Param('id') id: string,
    @Body() dto: UpdateRecipeIngredientDto,
  ) {
    return this.inventoryService.updateRecipeIngredient(id, dto);
  }

  @Delete('recipe-ingredients/:id')
  deleteRecipeIngredient(@Param('id') id: string) {
    return this.inventoryService.deleteRecipeIngredient(id);
  }
  @Patch('items/:id')
  updateItem(@Param('id') id: string, @Body() dto: UpdateInventoryItemDto) {
    return this.inventoryService.updateItem(id, dto);
  }

  @Patch('items/:id/trash')
  trashItem(@Param('id') id: string, @Body() dto: TrashInventoryItemDto) {
    return this.inventoryService.trashItem(id, dto);
  }

  @Patch('items/:id/restore')
  restoreItem(@Param('id') id: string) {
    return this.inventoryService.restoreItem(id);
  }
  @Delete('items/:id/permanent')
  permanentlyDeleteItem(@Param('id') id: string) {
    return this.inventoryService.permanentlyDeleteItem(id);
  }

  // Reserved for later if we add hard delete. Keep unused import Delete removed if not needed.
}
