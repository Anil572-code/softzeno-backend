import { Body, Controller, Get, Post } from '@nestjs/common';

import { CashSessionsService } from './cash-sessions.service';
import { CloseCashSessionDto } from './dto/close-cash-session.dto';
import { OpenCashSessionDto } from './dto/open-cash-session.dto';
import { SettlePaymentsDto } from './dto/settle-payments.dto';
import { PaymentsReadService } from './payments-read.service';
import { PaymentsSettlementService } from './payments-settlement.service';

@Controller('payments')
export class PaymentsController {
  constructor(
    private readonly paymentsReadService: PaymentsReadService,
    private readonly cashSessionsService: CashSessionsService,
    private readonly paymentsSettlementService: PaymentsSettlementService,
  ) {}

  @Get()
  getPayments() {
    return this.paymentsReadService.getPayments();
  }
  @Post('settlements/mark-settled')
  markPaymentsSettled(@Body() payload: SettlePaymentsDto) {
    return this.paymentsSettlementService.markSettled(payload);
  }

  @Get('cash-sessions/current')
  getCurrentCashSession() {
    return this.cashSessionsService.getCurrentSession();
  }

  @Post('cash-sessions/open')
  openCashSession(@Body() payload: OpenCashSessionDto) {
    return this.cashSessionsService.openSession(payload);
  }

  @Post('cash-sessions/close')
  closeCashSession(@Body() payload: CloseCashSessionDto) {
    return this.cashSessionsService.closeSession(payload);
  }

  @Get('cash-sessions')
  listCashSessions() {
    return this.cashSessionsService.listSessions();
  }
}
