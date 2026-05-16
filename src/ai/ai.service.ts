import { Injectable, InternalServerErrorException } from '@nestjs/common';
import OpenAI from 'openai';
import { GoogleGenAI } from '@google/genai';
import { AgentRouterService } from './agent-router.service';
import { ToolRegistryService } from './tool-registry.service';
import { AiChatDto } from './dto/ai-chat.dto';

type AiProvider = 'gemini' | 'openai' | 'openrouter' | 'nvidia';

type AiChatAgentMeta = {
  route: string;
  name: string;
  title: string;
  description: string;
};

type AiChatServiceResponse = {
  mode: 'read_only';
  provider: string;
  route: string;
  agent: AiChatAgentMeta;
  answer: string;
  snapshot: unknown;
  cached?: boolean;
};

type CachedAiResponse = {
  expiresAt: number;
  value: AiChatServiceResponse;
};

@Injectable()
export class AiService {
  private readonly openAiClient: OpenAI | null;
  private readonly geminiClient: GoogleGenAI | null;
  private readonly openRouterClient: OpenAI | null;
  private readonly nvidiaClient: OpenAI | null;
  private readonly responseCache = new Map<string, CachedAiResponse>();

  constructor(
    private readonly agentRouter: AgentRouterService,
    private readonly toolRegistry: ToolRegistryService,
  ) {
    const openAiKey = process.env.OPENAI_API_KEY;
    const geminiKey = process.env.GEMINI_API_KEY;
    const openRouterKey = process.env.OPENROUTER_API_KEY;
    const nvidiaKey = process.env.NVIDIA_API_KEY;

    this.openAiClient = openAiKey ? new OpenAI({ apiKey: openAiKey }) : null;

    this.geminiClient = geminiKey
      ? new GoogleGenAI({ apiKey: geminiKey })
      : null;

    this.openRouterClient = openRouterKey
      ? new OpenAI({
          apiKey: openRouterKey,
          baseURL: 'https://openrouter.ai/api/v1',
          defaultHeaders: {
            'HTTP-Referer': 'http://localhost:3000',
            'X-Title': 'Softzeno POS',
          },
        })
      : null;

    this.nvidiaClient = nvidiaKey
      ? new OpenAI({
          apiKey: nvidiaKey,
          baseURL:
            process.env.NVIDIA_BASE_URL ||
            'https://integrate.api.nvidia.com/v1',
        })
      : null;
  }

  async chat(dto: AiChatDto) {
    const message = dto.message.trim();
    const provider = this.getProvider();
    const compactSnapshot =
      await this.toolRegistry.getCompactBusinessSnapshot();

    if (!message) {
      const context = await this.agentRouter.buildContext('general');

      return {
        mode: 'read_only',
        provider,
        route: 'general',
        agent: this.buildAgentMeta(context.agent),
        answer: 'Please enter a question for Softzeno AI.',
        snapshot: compactSnapshot,
      };
    }

    const context = await this.agentRouter.buildContext(message);
    const agentMeta = this.buildAgentMeta(context.agent);

    if (this.isMockMode()) {
      return {
        mode: 'read_only',
        provider: 'mock',
        route: context.route,
        agent: agentMeta,
        answer: this.buildMockAnswer(message, context.route, compactSnapshot),
        snapshot: compactSnapshot,
      };
    }

    const cacheKey = this.buildCacheKey(provider, context.route, message);
    const cached = this.getCachedResponse(cacheKey);

    if (cached) {
      return {
        ...cached,
        cached: true,
      };
    }

    const prompt = this.buildPrompt(
      message,
      context.route,
      compactSnapshot,
      context.agent,
    );

    let response: AiChatServiceResponse | undefined;

    if (provider === 'gemini') {
      response = await this.chatWithGemini(
        prompt,
        context.route,
        agentMeta,
        compactSnapshot,
      );
    }

    if (provider === 'openrouter') {
      response = await this.chatWithOpenRouter(
        prompt,
        context.route,
        agentMeta,
        compactSnapshot,
      );
    }

    if (provider === 'nvidia') {
      response = await this.chatWithNvidia(
        prompt,
        context.route,
        agentMeta,
        compactSnapshot,
      );
    }

    if (provider === 'openai') {
      response = await this.chatWithOpenAi(
        prompt,
        context.route,
        agentMeta,
        compactSnapshot,
      );
    }

    if (!response) {
      response = {
        mode: 'read_only',
        provider,
        route: context.route,
        agent: agentMeta,
        answer: 'Softzeno AI provider is not configured correctly.',
        snapshot: compactSnapshot,
      };
    }

    this.setCachedResponse(cacheKey, response);

    return response;
  }

  private getProvider(): AiProvider {
    const provider = (process.env.AI_PROVIDER || 'gemini').toLowerCase();

    if (provider === 'openai') return 'openai';
    if (provider === 'openrouter') return 'openrouter';
    if (provider === 'nvidia') return 'nvidia';

    return 'gemini';
  }
  private buildAgentMeta(agent: {
    route: string;
    name: string;
    title: string;
    description: string;
  }): AiChatAgentMeta {
    return {
      route: agent.route,
      name: agent.name,
      title: agent.title,
      description: agent.description,
    };
  }

  private isMockMode() {
    return (process.env.AI_CHAT_MODE || 'live').toLowerCase() === 'mock';
  }

  private buildCacheKey(provider: string, route: string, message: string) {
    return `${provider}:${route}:${message.toLowerCase().trim()}`;
  }

  private getCachedResponse(cacheKey: string) {
    const cached = this.responseCache.get(cacheKey);

    if (!cached) return null;

    if (Date.now() > cached.expiresAt) {
      this.responseCache.delete(cacheKey);
      return null;
    }

    return cached.value;
  }

  private setCachedResponse(cacheKey: string, value: AiChatServiceResponse) {
    const ttlMinutes = Number(process.env.AI_CACHE_TTL_MINUTES || 5);

    if (ttlMinutes <= 0) {
      return;
    }

    this.responseCache.set(cacheKey, {
      expiresAt: Date.now() + ttlMinutes * 60_000,
      value,
    });
  }

  private buildPrompt(
    message: string,
    route: string,
    snapshot: unknown,
    agent: {
      name: string;
      title: string;
      description: string;
      systemPrompt: string;
      focusAreas: string[];
      riskRules: string[];
      recommendedActions: string[];
    },
  ) {
    return [
      'You are Softzeno AI, a premium business operations assistant for restaurants, cafes, lounges, retail shops, and malls.',
      'You are currently running in READ-ONLY mode.',
      'Use Nepali rupees format like Rs. 9,030. Never use dollars unless the data explicitly says USD.',
      'You must never claim that you changed, deleted, settled, approved, created, updated, or modified anything.',
      'You can analyze the provided business snapshot and suggest next actions.',
      'Keep answers practical, direct, and manager-friendly.',
      'When data is missing, say the backend data mapping may need connection instead of pretending.',
      'Always separate your answer into: Summary, Risks, Recommended Next Actions.',
      'Do not expose raw JSON, internal IDs, API keys, immutable hashes, or backend implementation details.',
      '',
      'Selected Softzeno Agent:',
      `Agent name: ${agent.name}`,
      `Agent title: ${agent.title}`,
      `Agent description: ${agent.description}`,
      '',
      'Agent system instructions:',
      agent.systemPrompt,
      '',
      'Agent focus areas:',
      agent.focusAreas.map((item) => `- ${item}`).join('\n'),
      '',
      'Agent risk rules:',
      agent.riskRules.map((item) => `- ${item}`).join('\n'),
      '',
      'Agent recommended action style:',
      agent.recommendedActions.map((item) => `- ${item}`).join('\n'),
      '',
      `User question:\n${message}`,
      '',
      `Detected agent route:\n${route}`,
      '',
      `Read-only Softzeno compact business snapshot:\n${JSON.stringify(
        snapshot,
        null,
        2,
      )}`,
    ].join('\n');
  }

  private buildMockAnswer(message: string, route: string, snapshot: any) {
    const totals = snapshot?.totals || {};
    const highlights = snapshot?.highlights || {};

    const baseSummary = `Mock mode is active, so no external AI request was used. The detected agent route is ${route}.`;
    const normalizedMessage = message.toLowerCase();
    const wantsCbms =
      normalizedMessage.includes('cbms') ||
      normalizedMessage.includes('ird') ||
      normalizedMessage.includes('tax') ||
      normalizedMessage.includes('compliance');

    if (route === 'orders') {
      const staleOrders = Array.isArray(highlights.staleDraftOrders)
        ? highlights.staleDraftOrders
        : [];

      const orderLines = staleOrders.length
        ? staleOrders
            .slice(0, 5)
            .map((order: any) => {
              return `- ${order.orderNumber} at ${order.tableName}, ${order.areaName}: ${order.ageMinutes} minutes old, KOT ${
                order.kotSent ? 'sent' : 'not sent'
              }.`;
            })
            .join('\n')
        : '- No stale draft orders detected in the compact snapshot.';

      return [
        '**Summary**',
        baseSummary,
        '',
        `There are ${Number(totals.runningOrders || 0).toLocaleString(
          'en-IN',
        )} running order(s), including ${Number(
          totals.staleDraftOrders || 0,
        ).toLocaleString('en-IN')} stale draft order(s).`,
        '',
        '**Risks**',
        'Stale draft orders can create table confusion, missed KOT flow, and inaccurate operational visibility.',
        '',
        '**Order Watchlist**',
        orderLines,
        '',
        '**Recommended Next Actions**',
        'Review these orders from the Orders/POS page, confirm whether customers are still present, and only cancel/clean up abandoned orders through the proper approval workflow.',
        '',
        `Original question: ${message}`,
      ].join('\n');
    }

    if (route === 'ledger') {
      return [
        '**Summary**',
        baseSummary,
        '',
        `Open credit accounts: ${Number(
          totals.openCreditAccounts || 0,
        ).toLocaleString('en-IN')}. Unpaid ledger balance: Rs. ${Number(
          totals.unpaidLedgerBalance || 0,
        ).toLocaleString('en-IN')}.`,
        '',
        '**Risks**',
        Number(totals.unpaidLedgerBalance || 0) > 0
          ? 'Unpaid ledger balance requires collection review and manager-approved settlement.'
          : 'No unpaid ledger exposure is visible from the compact snapshot.',
        '',
        '**Recommended Next Actions**',
        'Verify ledger mapping, review open accounts, and keep all settlement/collection actions approval-based.',
        '',
        `Original question: ${message}`,
      ].join('\n');
    }

    if (route === 'inventory') {
      return [
        '**Summary**',
        baseSummary,
        '',
        `Low stock items: ${Number(totals.lowStockItems || 0).toLocaleString(
          'en-IN',
        )}. Unavailable menu items: ${Number(
          totals.unavailableMenuItems || 0,
        ).toLocaleString('en-IN')}.`,
        '',
        '**Risks**',
        Number(totals.lowStockItems || 0) > 0
          ? 'Low stock can affect menu availability and service readiness.'
          : 'No low-stock risk is visible, but inventory thresholds and menu mapping should still be verified.',
        '',
        '**Recommended Next Actions**',
        'Check stock thresholds, verify ingredient-to-menu mapping, and prepare purchase suggestions only after manager review.',
        '',
        `Original question: ${message}`,
      ].join('\n');
    }

    if (route === 'menu') {
      return [
        '**Summary**',
        baseSummary,
        '',
        `Unavailable menu items: ${Number(
          totals.unavailableMenuItems || 0,
        ).toLocaleString('en-IN')}. Low stock items: ${Number(
          totals.lowStockItems || 0,
        ).toLocaleString('en-IN')}.`,
        '',
        '**Risks**',
        Number(totals.unavailableMenuItems || 0) > 0
          ? 'Unavailable items can affect customer experience and POS accuracy.'
          : 'No unavailable menu items are visible from the compact snapshot.',
        '',
        '**Recommended Next Actions**',
        'Verify kitchen readiness, stock mapping, and manager approval before changing menu availability.',
        '',
        `Original question: ${message}`,
      ].join('\n');
    }

    if (route === 'business_overview') {
      const pendingCbmsInvoices = Array.isArray(highlights.pendingCbmsInvoices)
        ? highlights.pendingCbmsInvoices
        : [];

      if (wantsCbms) {
        const cbmsLines = pendingCbmsInvoices.length
          ? pendingCbmsInvoices
              .slice(0, 5)
              .map((invoice: any) => {
                return `- ${invoice.invoiceNumber}: Rs. ${Number(
                  invoice.grandTotal || 0,
                ).toLocaleString(
                  'en-IN',
                )}, ${invoice.paymentMode || 'Unknown'} payment, ${invoice.paymentStatus || 'Unknown'} status, CBMS ${invoice.cbmsStatus || 'Pending'}.`;
              })
              .join('\n')
          : '- No pending CBMS invoices are visible in the compact snapshot.';

        return [
          '**Summary**',
          baseSummary,
          '',
          `Pending CBMS invoices: ${Number(
            totals.pendingCbmsInvoices || 0,
          ).toLocaleString('en-IN')}. Today invoices: ${Number(
            totals.todayInvoices || 0,
          ).toLocaleString('en-IN')}. Today revenue: Rs. ${Number(
            totals.todayRevenue || 0,
          ).toLocaleString('en-IN')}.`,
          '',
          '**Risks**',
          Number(totals.pendingCbmsInvoices || 0) > 0
            ? 'Pending CBMS invoices are compliance sync risks. They should be reviewed before relying on the invoice register as fully synced.'
            : 'No pending CBMS invoice risk is visible from the compact snapshot.',
          '',
          '**CBMS Watchlist**',
          cbmsLines,
          '',
          '**Recommended Next Actions**',
          'Open the IRD Invoice Register, verify pending CBMS invoices, retry/sync only through the approved backend workflow, and do not let AI mark invoices as synced.',
          '',
          `Original question: ${message}`,
        ].join('\n');
      }

      return [
        '**Summary**',
        baseSummary,
        '',
        `Today revenue is Rs. ${Number(totals.todayRevenue || 0).toLocaleString(
          'en-IN',
        )}, with ${Number(totals.todayInvoices || 0).toLocaleString(
          'en-IN',
        )} invoice(s), ${Number(totals.runningOrders || 0).toLocaleString(
          'en-IN',
        )} running order(s), and ${Number(
          totals.pendingCbmsInvoices || 0,
        ).toLocaleString('en-IN')} pending CBMS invoice(s).`,
        '',
        '**Risks**',
        Number(totals.runningOrders || 0) > 0
          ? 'Running orders need review, especially stale draft orders without KOT.'
          : Number(totals.pendingCbmsInvoices || 0) > 0
            ? 'Pending CBMS invoices need compliance review.'
            : 'No major running-order or CBMS issue is visible from the compact snapshot.',
        '',
        '**Recommended Next Actions**',
        'Review stale draft orders, verify pending CBMS invoices, and check credit/stock signals before relying on live AI output.',
        '',
        `Original question: ${message}`,
      ].join('\n');
    }

    return [
      '**Summary**',
      baseSummary,
      '',
      'I can help review Softzeno business signals in read-only mode. For better results, ask about a specific area like orders, ledger, inventory, menu, CBMS, or today’s attention.',
      '',
      '**Available Checks**',
      '- Today’s attention and business overview.',
      '- Running orders, stale drafts, and KOT risk.',
      '- Credit exposure and ledger settlement risk.',
      '- Inventory readiness and low-stock pressure.',
      '- Menu availability and POS readiness.',
      '- Pending CBMS invoice risk.',
      '',
      '**Recommended Next Actions**',
      'Use one of the quick checks or ask a direct question such as: “Show running order issues” or “What needs attention today?”',
      '',
      `Original question: ${message}`,
    ].join('\n');
  }

  private async chatWithGemini(
    prompt: string,
    route: string,
    agent: AiChatAgentMeta,
    compactSnapshot: unknown,
  ) {
    if (!this.geminiClient) {
      return {
        mode: 'read_only' as const,
        provider: 'gemini',
        route,
        answer:
          'Softzeno AI backend is ready, but GEMINI_API_KEY is missing in backend .env.',
        snapshot: compactSnapshot,
        agent,
      };
    }

    try {
      const response = await this.geminiClient.models.generateContent({
        model: process.env.GEMINI_MODEL || 'gemini-2.5-flash-lite',
        contents: prompt,
      });

      return {
        mode: 'read_only' as const,
        provider: 'gemini',
        route,
        agent,
        answer: response.text || 'Gemini returned an empty response.',
        snapshot: compactSnapshot,
      };
    } catch (error) {
      throw new InternalServerErrorException({
        message: 'Softzeno AI failed to generate a Gemini response.',
        details:
          error instanceof Error
            ? error.message
            : 'Unknown Gemini or backend error.',
      });
    }
  }

  private async chatWithOpenRouter(
    prompt: string,
    route: string,
    agent: AiChatAgentMeta,
    compactSnapshot: unknown,
  ) {
    if (!this.openRouterClient) {
      return {
        mode: 'read_only' as const,
        provider: 'openrouter',
        route,
        agent,
        answer:
          'Softzeno AI backend is ready, but OPENROUTER_API_KEY is missing in backend .env.',
        snapshot: compactSnapshot,
      };
    }

    try {
      const response = await this.openRouterClient.chat.completions.create({
        model: process.env.OPENROUTER_MODEL || 'openrouter/free',
        messages: [
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 0.3,
      });

      return {
        mode: 'read_only' as const,
        provider: 'openrouter',
        route,
        agent,
        answer:
          response.choices[0]?.message?.content ||
          'OpenRouter returned an empty response.',
        snapshot: compactSnapshot,
      };
    } catch (error) {
      throw new InternalServerErrorException({
        message: 'Softzeno AI failed to generate an OpenRouter response.',
        details:
          error instanceof Error
            ? error.message
            : 'Unknown OpenRouter or backend error.',
      });
    }
  }

  private async chatWithNvidia(
    prompt: string,
    route: string,
    agent: AiChatAgentMeta,
    compactSnapshot: unknown,
  ) {
    if (!this.nvidiaClient) {
      return {
        mode: 'read_only' as const,
        provider: 'nvidia',
        route,
        agent,
        answer:
          'Softzeno AI backend is ready, but NVIDIA_API_KEY is missing in backend .env.',
        snapshot: compactSnapshot,
      };
    }

    try {
      const response = await this.nvidiaClient.chat.completions.create({
        model: process.env.NVIDIA_MODEL || 'meta/llama-3.1-70b-instruct',
        messages: [
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 0.3,
      });

      return {
        mode: 'read_only' as const,
        provider: 'nvidia',
        route,
        agent,
        answer:
          response.choices[0]?.message?.content ||
          'NVIDIA returned an empty response.',
        snapshot: compactSnapshot,
      };
    } catch (error) {
      throw new InternalServerErrorException({
        message: 'Softzeno AI failed to generate an NVIDIA response.',
        details:
          error instanceof Error
            ? error.message
            : 'Unknown NVIDIA or backend error.',
      });
    }
  }

  private async chatWithOpenAi(
    prompt: string,
    route: string,
    agent: AiChatAgentMeta,
    compactSnapshot: unknown,
  ) {
    if (!this.openAiClient) {
      return {
        mode: 'read_only' as const,
        provider: 'openai',
        route,
        agent,
        answer:
          'Softzeno AI backend is ready, but OPENAI_API_KEY is missing in backend .env.',
        snapshot: compactSnapshot,
      };
    }

    try {
      const response = await this.openAiClient.responses.create({
        model: process.env.SOFTZENO_AI_MODEL || 'gpt-4.1-mini',
        instructions:
          'You are Softzeno AI. Follow the prompt exactly and stay read-only.',
        input: prompt,
      });

      return {
        mode: 'read_only' as const,
        provider: 'openai',
        route,
        agent,
        answer: response.output_text || 'OpenAI returned an empty response.',
        snapshot: compactSnapshot,
      };
    } catch (error) {
      throw new InternalServerErrorException({
        message: 'Softzeno AI failed to generate an OpenAI response.',
        details:
          error instanceof Error
            ? error.message
            : 'Unknown OpenAI or backend error.',
      });
    }
  }
}
