import { Module } from '@nestjs/common';
import { AiController } from './ai.controller';
import { AiService } from './ai.service';
import { AgentRouterService } from './agent-router.service';
import { ToolRegistryService } from './tool-registry.service';
import { PrismaService } from '../prisma/prisma.service';

@Module({
  controllers: [AiController],
  providers: [
    AiService,
    AgentRouterService,
    ToolRegistryService,
    PrismaService,
  ],
  exports: [AiService],
})
export class AiModule {}
