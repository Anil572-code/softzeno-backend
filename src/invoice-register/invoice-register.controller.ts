import { Controller, Get, Param } from '@nestjs/common';

import { InvoiceRegisterService } from './invoice-register.service';

@Controller('invoice-register')
export class InvoiceRegisterController {
  constructor(
    private readonly invoiceRegisterService: InvoiceRegisterService,
  ) {}

  @Get()
  getRegister() {
    return this.invoiceRegisterService.getRegister();
  }

  @Get(':invoiceId')
  getRegisterDetail(@Param('invoiceId') invoiceId: string) {
    return this.invoiceRegisterService.getRegisterDetail(invoiceId);
  }
}
