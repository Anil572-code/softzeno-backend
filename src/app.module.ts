import { Module } from '@nestjs/common';
import { ContextModule } from './context/context.module';
import { FiscalModule } from './fiscal/fiscal.module';
import { ConfigModule } from '@nestjs/config';
import { BillingModule } from './billing/billing.module';
import { LedgerModule } from './ledger/ledger.module';
import { InvoiceRegisterModule } from './invoice-register/invoice-register.module';
import { MenuModule } from './menu/menu.module';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { HealthModule } from './health/health.module';
import { PrismaModule } from './prisma/prisma.module';
import { TablesModule } from './tables/tables.module';
import { DevModule } from './dev/dev.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { OrdersModule } from './orders/orders.module';
import { InventoryModule } from './inventory/inventory.module';
import { PaymentsModule } from './payments/payments.module';
import { AiModule } from './ai/ai.module';
import { AuthModule } from './auth/auth.module';
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    PrismaModule,
    FiscalModule,
    BillingModule,
    HealthModule,
    InvoiceRegisterModule,
    MenuModule,
    LedgerModule,
    ContextModule,
    TablesModule,
    DevModule,
    DashboardModule,
    OrdersModule,
    InventoryModule,
    PaymentsModule,
    AiModule,
    AuthModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
