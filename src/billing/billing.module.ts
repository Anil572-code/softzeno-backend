import { Module } from '@nestjs/common';

import { BillingController } from './billing.controller';
import { BillingReadService } from './billing-read.service';
import { BillingTotalService } from './billing-total.service';
import { FinalizeInvoiceService } from './finalize-invoice.service';

@Module({
  controllers: [BillingController],
  providers: [BillingTotalService, FinalizeInvoiceService, BillingReadService],
  exports: [BillingTotalService, FinalizeInvoiceService, BillingReadService],
})
export class BillingModule {}
