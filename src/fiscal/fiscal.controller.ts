import { Controller, Get, Post } from '@nestjs/common';

import { FiscalService } from './fiscal.service';

@Controller('fiscal')
export class FiscalController {
  constructor(private readonly fiscalService: FiscalService) {}

  @Get('current')
  getCurrentFiscalContext() {
    return this.fiscalService.getCurrentFiscalContext();
  }

  @Post('preview-next-invoice')
  previewNextInvoiceNumber() {
    return this.fiscalService.previewNextInvoiceNumber();
  }

  @Post('issue-next-invoice-number')
  issueNextInvoiceNumber() {
    return this.fiscalService.issueNextInvoiceNumberForDemoOnly();
  }
}
