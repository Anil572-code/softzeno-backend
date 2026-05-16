import { Controller, Get } from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';

@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async check() {
    const businessCount = await this.prisma.business.count();
    const branchCount = await this.prisma.branch.count();
    const terminalCount = await this.prisma.terminal.count();
    const userCount = await this.prisma.user.count();
    const fiscalYearCount = await this.prisma.fiscalYear.count();

    return {
      status: 'ok',
      database: 'connected',
      seed: {
        businesses: businessCount,
        branches: branchCount,
        terminals: terminalCount,
        users: userCount,
        fiscalYears: fiscalYearCount,
      },
      timestamp: new Date().toISOString(),
    };
  }
}
