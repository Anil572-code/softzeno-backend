export type AiAgentRoute =
  | 'business_overview'
  | 'ledger'
  | 'inventory'
  | 'orders'
  | 'menu'
  | 'general';

export type AiAgentRiskLevel = 'low' | 'medium' | 'high';

export type AiAgentDefinition = {
  route: AiAgentRoute;
  name: string;
  title: string;
  description: string;
  systemPrompt: string;
  focusAreas: string[];
  riskRules: string[];
  recommendedActions: string[];
};
