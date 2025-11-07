import OpenAI from 'openai';
import { PlannedAction, PlannerContext, ToolCall } from './types.js';

export interface ModelResponse {
  actions: PlannedAction[];
  model: string;
}

export class SmallModelFirstClient {
  private readonly primaryModel: string;
  private readonly fallbackModel: string;
  private readonly openai?: OpenAI;

  constructor() {
    this.primaryModel = process.env.AI_MODEL ?? 'gpt-4.1-mini';
    this.fallbackModel = process.env.AI_MODEL_FALLBACK ?? 'gpt-4.1';
    const apiKey = process.env.OPENAI_API_KEY;
    if (apiKey) {
      this.openai = new OpenAI({ apiKey });
    }
  }

  async proposeAction(context: PlannerContext): Promise<ModelResponse> {
    const prompt = this.buildPrompt(context);
    if (!this.openai) {
      throw new Error('OPENAI_API_KEY is not configured; planner cannot run.');
    }

    const models = [this.primaryModel, this.fallbackModel];
    const errors: Error[] = [];
    for (const model of models) {
      try {
        const completion = await this.openai.responses.create({
          model,
          reasoning: { effort: 'medium' },
          input: [
            {
              role: 'system',
              content:
                'You plan UI interactions as compact JSON. Output ONLY JSON that matches the provided schema.',
            },
            { role: 'user', content: prompt },
          ],
          max_output_tokens: 256,
          response_format: {
            type: 'json_schema',
            json_schema: {
              name: 'tool_plan',
              strict: true,
              schema: {
                type: 'object',
                additionalProperties: false,
                required: ['actions'],
                properties: {
                  actions: {
                    type: 'array',
                    minItems: 1,
                    maxItems: 3,
                    items: this.toolSchema(),
                  },
                },
              },
            },
          },
        });

        const content = completion.output[0]?.content?.[0];
        if (!content || content.type !== 'output_text') {
          throw new Error('Planner returned empty content');
        }

        const payload = JSON.parse(content.text) as { actions: PlannedAction[] };
        return { actions: payload.actions.map(this.normalizeAction), model };
      } catch (error) {
        errors.push(error as Error);
      }
    }

    const err = errors[errors.length - 1];
    throw err ?? new Error('Unable to plan actions');
  }

  private normalizeAction(action: PlannedAction): PlannedAction {
    const call: ToolCall = {
      type: action.call.type,
      target: action.call.target,
      value: action.call.value,
      expectation: action.call.expectation,
      description: action.call.description,
    };

    return {
      call,
      expectation: action.expectation ?? action.call.expectation ?? '',
      rationale: action.rationale ?? '',
    };
  }

  private toolSchema() {
    return {
      type: 'object',
      additionalProperties: false,
      required: ['call', 'expectation', 'rationale'],
      properties: {
        call: {
          type: 'object',
          additionalProperties: false,
          required: ['type'],
          properties: {
            type: {
              type: 'string',
              enum: ['navigate', 'click', 'fill', 'assertText', 'waitFor', 'pressKey', 'hover'],
            },
            target: { type: 'string' },
            value: { type: 'string' },
            expectation: { type: 'string' },
            description: { type: 'string' },
          },
        },
        expectation: { type: 'string', maxLength: 120 },
        rationale: { type: 'string', maxLength: 200 },
      },
    };
  }

  private buildPrompt(context: PlannerContext): string {
    const summary = [
      `Feature: ${context.featureName}`,
      `Scenario: ${context.scenarioName}`,
      `Tags: ${context.tags.join(', ')}`,
      'Steps:',
      ...context.steps.map((step, index) => `${index + 1}. ${step}`),
    ].join('\n');

    const delta = context.observation
      ? `Latest observation: ${JSON.stringify(context.observation)}`
      : 'No observations yet. Start with navigation.';

    const history = context.previousActions
      .map((action, index) => `${index + 1}. ${action.call.type} -> ${action.expectation}`)
      .join('\n');

    const failure = context.failure ? `Previous error: ${context.failure}` : 'No failures yet.';

    return [
      summary,
      '',
      'You plan exactly one atomic interaction and a short expectation statement for verification.',
      'Respect budgets and choose deterministic selectors.',
      'Allowed actions: navigate, click, fill, assertText, waitFor, pressKey, hover.',
      'Selector rules: prefer data-testid or accessible names. Avoid brittle CSS.',
      'Return at most 3 candidate actions sorted by confidence. Each must include expectation and rationale.',
      'If verification fails, adjust plan accordingly.',
      '',
      delta,
      '',
      failure,
      '',
      'History of executed actions (most recent last):',
      history || 'None',
    ].join('\n');
  }
}
