import { IWorldOptions, setWorldConstructor, World } from '@cucumber/cucumber';
import { AgentRunResult } from '../agent/types.js';

export interface ScenarioState {
  featureName: string;
  scenarioName: string;
  featureUri: string;
  tags: string[];
  steps: string[];
  result?: AgentRunResult;
}

export class AgentWorld extends World<ScenarioState> {
  state: ScenarioState;

  constructor(options: IWorldOptions) {
    super(options);
    const featureName = options.gherkinDocument.feature?.name ?? 'Unknown feature';
    const scenarioName = options.pickle.name ?? 'Unknown scenario';
    const featureUri = options.pickle.uri ?? 'feature';
    const tags = options.pickle.tags?.map((tag) => tag.name) ?? [];
    this.state = {
      featureName,
      scenarioName,
      featureUri,
      tags,
      steps: [],
    };
  }

  recordStep(step: string) {
    this.state.steps.push(step);
  }

  setResult(result: AgentRunResult) {
    this.state.result = result;
  }

  getResult(): AgentRunResult | undefined {
    return this.state.result;
  }
}

setWorldConstructor(AgentWorld);
