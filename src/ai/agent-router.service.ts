import { Injectable } from '@nestjs/common';
import { ToolRegistryService } from './tool-registry.service';
import type { AiAgentDefinition, AiAgentRoute } from './agents/ai-agent.types';
import { businessOverviewAgent } from './agents/business-overview.agent';
import { generalAgent } from './agents/general.agent';
import { inventoryAgent } from './agents/inventory.agent';
import { ledgerAgent } from './agents/ledger.agent';
import { menuAgent } from './agents/menu.agent';
import { ordersAgent } from './agents/orders.agent';

@Injectable()
export class AgentRouterService {
  private readonly agents: Record<AiAgentRoute, AiAgentDefinition> = {
    business_overview: businessOverviewAgent,
    ledger: ledgerAgent,
    inventory: inventoryAgent,
    orders: ordersAgent,
    menu: menuAgent,
    general: generalAgent,
  };

  constructor(private readonly toolRegistry: ToolRegistryService) {}

  detectRoute(message: string): AiAgentRoute {
    const normalized = message.toLowerCase();

    if (
      normalized.includes('credit') ||
      normalized.includes('ledger') ||
      normalized.includes('due') ||
      normalized.includes('unpaid') ||
      normalized.includes('payment') ||
      normalized.includes('settlement') ||
      normalized.includes('collect')
    ) {
      return 'ledger';
    }

    if (
      normalized.includes('stock') ||
      normalized.includes('inventory') ||
      normalized.includes('ingredient') ||
      normalized.includes('purchase') ||
      normalized.includes('supplier') ||
      normalized.includes('wastage')
    ) {
      return 'inventory';
    }

    if (
      normalized.includes('order') ||
      normalized.includes('kot') ||
      normalized.includes('kitchen') ||
      normalized.includes('table') ||
      normalized.includes('draft') ||
      normalized.includes('running')
    ) {
      return 'orders';
    }

    if (
      normalized.includes('menu') ||
      normalized.includes('item') ||
      normalized.includes('price') ||
      normalized.includes('unavailable') ||
      normalized.includes('available')
    ) {
      return 'menu';
    }

    if (
      normalized.includes('today') ||
      normalized.includes('attention') ||
      normalized.includes('summary') ||
      normalized.includes('business') ||
      normalized.includes('sales') ||
      normalized.includes('revenue') ||
      normalized.includes('cbms') ||
      normalized.includes('overview')
    ) {
      return 'business_overview';
    }

    return 'general';
  }
  getAgent(route: AiAgentRoute) {
    return this.agents[route] || generalAgent;
  }
  listAgents() {
    return Object.values(this.agents).map((agent) => ({
      route: agent.route,
      name: agent.name,
      title: agent.title,
      description: agent.description,
      focusAreas: agent.focusAreas,
      riskRules: agent.riskRules,
      recommendedActions: agent.recommendedActions,
    }));
  }
  async buildContext(message: string) {
    const route = this.detectRoute(message);
    const agent = this.getAgent(route);
    const snapshot = await this.toolRegistry.getBusinessSnapshot();

    return {
      route,
      agent,
      snapshot,
    };
  }
}
