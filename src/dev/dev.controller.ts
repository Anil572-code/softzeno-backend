import { Body, Controller, Get, Post } from '@nestjs/common';

import { DevService } from './dev.service';

type ResetDemoDataBody = {
  confirmation?: string;
};

type ClearOrphanTableOccupancyBody = {
  confirmation?: string;
};
type CloseStuckOrdersBody = {
  confirmation?: string;
  orderIds?: string[];
};

@Controller('dev')
export class DevController {
  constructor(private readonly devService: DevService) {}

  @Get('reset-demo-data/status')
  getResetStatus() {
    return this.devService.getResetStatus();
  }

  @Post('reset-demo-data')
  resetDemoData(@Body() body: ResetDemoDataBody) {
    return this.devService.resetDemoData(body.confirmation);
  }
  @Post('close-stuck-orders')
  closeStuckOrders(@Body() body: CloseStuckOrdersBody) {
    return this.devService.closeStuckOrders(body.confirmation, body.orderIds);
  }
  @Post('clear-orphan-table-occupancy')
  clearOrphanTableOccupancy(@Body() body: ClearOrphanTableOccupancyBody) {
    return this.devService.clearOrphanTableOccupancy(body.confirmation);
  }
}
