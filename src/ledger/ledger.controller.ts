import { UpdateLedgerAccountDto } from './dto/update-ledger-account.dto';
import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';

import { CollectLedgerPaymentDto } from './dto/collect-ledger-payment.dto';
import { CreateLedgerAccountDto } from './dto/create-ledger-account.dto';
import { LedgerService } from './ledger.service';

@Controller('ledger')
export class LedgerController {
  constructor(private readonly ledgerService: LedgerService) {}

  @Get('accounts')
  getAccounts() {
    return this.ledgerService.getAccounts();
  }
  @Patch('accounts/:id')
  updateAccount(@Param('id') id: string, @Body() dto: UpdateLedgerAccountDto) {
    return this.ledgerService.updateAccount(id, dto);
  }

  @Get('accounts/:id/statement')
  getAccountStatement(@Param('id') id: string) {
    return this.ledgerService.getAccountStatement(id);
  }
  @Post('accounts')
  createAccount(@Body() payload: CreateLedgerAccountDto) {
    return this.ledgerService.createAccount(payload);
  }
  @Post('collect-payment')
  collectPayment(@Body() payload: CollectLedgerPaymentDto) {
    return this.ledgerService.collectPayment(payload);
  }
}
