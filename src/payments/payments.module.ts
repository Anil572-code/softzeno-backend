import { Module } from '@nestjs/common';

import { PrismaModule } from '../prisma/prisma.module';
import { CashSessionsService } from './cash-sessions.service';
import { PaymentsController } from './payments.controller';
import { PaymentsReadService } from './payments-read.service';
import { PaymentsSettlementService } from './payments-settlement.service';

@Module({
  imports: [PrismaModule],
  controllers: [PaymentsController],
  providers: [
    PaymentsReadService,
    CashSessionsService,
    PaymentsSettlementService,
  ],
  exports: [
    PaymentsReadService,
    CashSessionsService,
    PaymentsSettlementService,
  ],
})
export class PaymentsModule {}
