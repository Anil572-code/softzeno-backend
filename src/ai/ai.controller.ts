import { Body, Controller, Get, Post } from '@nestjs/common';
import { AiService } from './ai.service';
import { ToolRegistryService } from './tool-registry.service';
import { AiChatDto } from './dto/ai-chat.dto';
import { AgentRouterService } from './agent-router.service';

@Controller('ai')
export class AiController {
  constructor(
    private readonly aiService: AiService,
    private readonly toolRegistry: ToolRegistryService,
    private readonly agentRouter: AgentRouterService,
  ) {}

  @Get('health')
  health() {
    const openAiKey = process.env.OPENAI_API_KEY || '';
    const geminiKey = process.env.GEMINI_API_KEY || '';

    return {
      status: 'ok',
      module: 'Softzeno AI',
      mode: 'read_only',
      provider: process.env.AI_PROVIDER || 'gemini',
      message: 'Softzeno AI backend is active.',
      openAiKeyLoaded: Boolean(openAiKey),
      openAiKeyPreview: openAiKey
        ? `${openAiKey.slice(0, 7)}...${openAiKey.slice(-4)}`
        : null,
      geminiKeyLoaded: Boolean(geminiKey),
      geminiKeyPreview: geminiKey
        ? `${geminiKey.slice(0, 7)}...${geminiKey.slice(-4)}`
        : null,
      openAiModel: process.env.SOFTZENO_AI_MODEL || null,
      geminiModel: process.env.GEMINI_MODEL || null,
    };
  }
  @Get('agents')
  agents() {
    return {
      mode: 'read_only',
      agents: this.agentRouter.listAgents(),
    };
  }
  @Get('snapshot')
  snapshot() {
    return this.toolRegistry.getBusinessSnapshot();
  }

  @Get('summary')
  summary() {
    return this.toolRegistry.getCompactBusinessSnapshot();
  }

  @Post('chat')
  chat(@Body() dto: AiChatDto) {
    return this.aiService.chat(dto);
  }
}
