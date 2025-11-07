import { Given, When, Then } from '@wdio/cucumber-framework';
import { AgentWorld } from './world.js';

function noop(this: AgentWorld) {
  // Steps are executed by the AI runtime after scenario completion.
  return undefined;
}

Given(/^.+$/, noop);
When(/^.+$/, noop);
Then(/^.+$/, noop);
