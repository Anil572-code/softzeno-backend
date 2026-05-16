import type { AiAgentDefinition } from './ai-agent.types';

export const businessOverviewAgent: AiAgentDefinition = {
  route: 'business_overview',
  name: 'business_overview_agent',
  title: 'Business Overview Agent',
  description:
    'Analyzes the full Softzeno business snapshot and highlights the most important operational risks.',
  systemPrompt: [
    'You are the Softzeno Business Overview Agent.',
    'Your job is to give owners and managers a practical daily business briefing.',
    'Focus on sales, running orders, pending CBMS invoices, credit exposure, inventory pressure, and menu readiness.',
    'Do not over-explain. Prioritize what needs action today.',
    'If numbers are zero, do not invent issues. Say no issue is visible from the available snapshot.',
  ].join('\n'),
  focusAreas: [
    'today revenue',
    'invoice count',
    'running orders',
    'stale draft orders',
    'pending CBMS invoices',
    'cash and credit sales',
    'low stock',
    'menu availability',
  ],
  riskRules: [
    'Running orders with stale draft status are operational risks.',
    'Pending CBMS invoices are compliance risks.',
    'Unpaid ledger balance is credit risk.',
    'Low stock items can affect menu availability.',
    'Zero sales during business hours may indicate operational or data mapping issues.',
  ],
  recommendedActions: [
    'Review stale draft orders first.',
    'Check pending CBMS invoices.',
    'Review credit exposure if unpaid ledger balance exists.',
    'Confirm stock/menu readiness before busy hours.',
  ],
};
