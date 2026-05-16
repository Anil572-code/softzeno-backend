import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';

import { AddOrderItemDto } from './dto/add-order-item.dto';
import { SendKotDto } from './dto/send-kot.dto';
import { VoidOrderItemDto } from './dto/void-order-item.dto';
import { OrdersService } from './orders.service';

@Controller('orders')
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Get('active')
  getActiveOrders() {
    return this.ordersService.getActiveOrders();
  }

  @Get('history')
  getOrderHistory() {
    return this.ordersService.getOrderHistory();
  }

  @Get('kot-tickets')
  getKotTickets() {
    return this.ordersService.getKotTickets();
  }

  @Get('table/:tableId/active')
  getActiveOrderByTable(@Param('tableId') tableId: string) {
    return this.ordersService.getActiveOrderByTable(tableId);
  }

  @Get(':orderId')
  getOrderById(@Param('orderId') orderId: string) {
    return this.ordersService.getOrderById(orderId);
  }

  @Post('table/:tableId')
  createOrGetTableOrder(@Param('tableId') tableId: string) {
    return this.ordersService.createOrGetTableOrder(tableId);
  }

  @Post(':orderId/items')
  addItem(@Param('orderId') orderId: string, @Body() payload: AddOrderItemDto) {
    return this.ordersService.addItem(orderId, payload);
  }

  @Patch(':orderId/items/:itemId/quantity')
  updateItemQuantity(
    @Param('orderId') orderId: string,
    @Param('itemId') itemId: string,
    @Body() payload: { qty?: number },
  ) {
    return this.ordersService.updateItemQuantity(orderId, itemId, payload.qty);
  }

  @Post(':orderId/items/:itemId/void')
  voidOrderItem(
    @Param('orderId') orderId: string,
    @Param('itemId') itemId: string,
    @Body() payload: VoidOrderItemDto,
  ) {
    return this.ordersService.voidOrderItem(orderId, itemId, payload);
  }

  @Post(':orderId/send-kot')
  sendKot(@Param('orderId') orderId: string, @Body() payload: SendKotDto) {
    return this.ordersService.sendKot(orderId, payload);
  }

  @Post('kot-tickets/:ticketId/mark-preparing')
  markKotTicketPreparing(
    @Param('ticketId') ticketId: string,
    @Body() payload: { performedById?: string; performedByName?: string },
  ) {
    return this.ordersService.markKotTicketPreparing(ticketId, payload);
  }

  @Post('kot-tickets/:ticketId/mark-ready')
  markKotTicketReady(
    @Param('ticketId') ticketId: string,
    @Body() payload: { performedById?: string; performedByName?: string },
  ) {
    return this.ordersService.markKotTicketReady(ticketId, payload);
  }

  @Post('kot-tickets/:ticketId/mark-served')
  markKotTicketServed(
    @Param('ticketId') ticketId: string,
    @Body() payload: { performedById?: string; performedByName?: string },
  ) {
    return this.ordersService.markKotTicketServed(ticketId, payload);
  }
}
