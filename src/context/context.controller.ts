import { Controller, Get } from '@nestjs/common';

import { ContextService } from './context.service';

@Controller('context')
export class ContextController {
  constructor(private readonly contextService: ContextService) {}

  @Get('demo')
  getDemoContext() {
    return this.contextService.getDemoContext();
  }
}
