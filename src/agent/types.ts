export type ToolCallType =
  | 'navigate'
  | 'click'
  | 'fill'
  | 'assertText'
  | 'waitFor'
  | 'pressKey'
  | 'hover';

export interface ToolCall {
  type: ToolCallType;
  target?: string;
  value?: string;
  expectation?: string;
  description?: string;
}

export interface PlannedAction {
  call: ToolCall;
  expectation: string;
  rationale: string;
}

export interface PlannerContext {
  scenarioName: string;
  featureName: string;
  steps: string[];
  tags: string[];
  previousActions: PlannedAction[];
  observation: ObservationDelta | null;
  failure?: string;
  remainingActionBudget: number;
  remainingReplanBudget: number;
}

export interface Observation {
  url: string;
  title: string;
  visibleTexts: string[];
  interactiveElements: string[];
  lastToast?: string | null;
}

export interface ObservationDelta {
  urlChanged?: boolean;
  titleChanged?: boolean;
  url?: string;
  title?: string;
  addedTexts: string[];
  removedTexts: string[];
  interactiveElements: string[];
  lastToast?: string | null;
}

export interface AgentHistoryEntry {
  action: PlannedAction;
  observation: Observation;
  delta: ObservationDelta;
  success: boolean;
  error?: string;
  healed?: boolean;
}

export interface AgentRunResult {
  status: 'skipped' | 'passed' | 'failed';
  reason?: string;
  history: AgentHistoryEntry[];
  cachedPlanUsed: boolean;
  planPersisted: boolean;
}

export interface CachedPlan {
  version: number;
  feature: string;
  scenario: string;
  tags: string[];
  createdAt: string;
  actions: PlannedAction[];
}
