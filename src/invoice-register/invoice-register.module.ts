import { Module } from '@nestjs/common';

import { InvoiceRegisterController } from './invoice-register.controller';
import { InvoiceRegisterService } from './invoice-register.service';

@Module({
  controllers: [InvoiceRegisterController],
  providers: [InvoiceRegisterService],
  exports: [InvoiceRegisterService],
})
export class InvoiceRegisterModule {}
