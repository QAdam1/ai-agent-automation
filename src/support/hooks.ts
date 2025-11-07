import { After, Before, BeforeStep } from '@wdio/cucumber-framework';
import { AgentWorld } from './world.js';
import { getAgentRuntime } from '../runtime/runtime-factory.js';

Before(function (this: AgentWorld) {
  this.state.steps = [];
});

BeforeStep(function (this: AgentWorld, step: any) {
  const text = step.pickleStep?.text ?? step.text ?? '';
  if (text) {
    this.recordStep(text);
  }
});

After(async function (this: AgentWorld) {
  const runtime = getAgentRuntime();
  const result = await runtime.run({
    featureName: this.state.featureName,
    scenarioName: this.state.scenarioName,
    featureUri: this.state.featureUri,
    steps: this.state.steps,
    tags: this.state.tags,
  });
  this.setResult(result);
  if (this.attach) {
    await this.attach(JSON.stringify(result, null, 2), 'application/json');
  }

  if (result.status === 'failed') {
    throw new Error(result.reason ?? 'AI agent run failed');
  }
});
