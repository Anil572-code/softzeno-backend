import { Body, Controller, Get, Param, Post } from '@nestjs/common';

import { BillingReadService } from './billing-read.service';
import { BillingTotalService } from './billing-total.service';
import { CalculateBillTotalDto } from './dto/calculate-bill-total.dto';
import { FinalizeInvoiceDto } from './dto/finalize-invoice.dto';
import { FinalizeInvoiceService } from './finalize-invoice.service';

@Controller('billing')
export class BillingController {
  constructor(
    private readonly billingTotalService: BillingTotalService,
    private readonly finalizeInvoiceService: FinalizeInvoiceService,
    private readonly billingReadService: BillingReadService,
  ) {}

  @Post('calculate-totals')
  calculateTotals(@Body() payload: CalculateBillTotalDto) {
    return this.billingTotalService.calculateTotals(payload);
  }

  @Post('finalize-invoice')
  finalizeInvoice(@Body() payload: FinalizeInvoiceDto) {
    return this.finalizeInvoiceService.finalizeInvoice(payload);
  }

  @Get('invoices')
  getInvoices() {
    return this.billingReadService.getInvoices();
  }

  @Get('invoices/:id')
  getInvoiceById(@Param('id') id: string) {
    return this.billingReadService.getInvoiceById(id);
  }

  @Get('payments')
  getPayments() {
    return this.billingReadService.getPayments();
  }

  @Get('ledger-entries')
  getLedgerEntries() {
    return this.billingReadService.getLedgerEntries();
  }

  @Get('cbms-logs')
  getCbmsLogs() {
    return this.billingReadService.getCbmsLogs();
  }
}
