import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { PlanCache } from '../agent/cache.js';
import { LocatorHealer } from '../agent/locator-healer.js';
import { SmallModelFirstClient } from '../agent/model-client.js';
import { AgentObserver } from '../agent/observer.js';
import { ToolExecutor } from '../agent/executor.js';
import { ExpectationVerifier } from '../agent/verifier.js';
import {
  AgentHistoryEntry,
  AgentRunResult,
  Observation,
  ObservationDelta,
  PlannedAction,
  PlannerContext,
} from '../agent/types.js';
import { logger } from '../utils/logger.js';

export interface ScenarioInput {
  featureName: string;
  scenarioName: string;
  featureUri: string;
  steps: string[];
  tags: string[];
}

export interface AgentRuntimeOptions {
  maxActions?: number;
  maxReplans?: number;
  artifactDir?: string;
  whitelist?: string[];
}

export class AgentRuntime {
  private readonly planner = new SmallModelFirstClient();
  private readonly cache = PlanCache.fromFeaturesRoot();
  private readonly executor: ToolExecutor;
  private readonly observer = new AgentObserver();
  private readonly verifier = new ExpectationVerifier();
  private readonly healer = new LocatorHealer();
  private readonly maxActions: number;
  private readonly maxReplans: number;
  private readonly artifactDir: string;

  constructor(options?: AgentRuntimeOptions) {
    this.executor = new ToolExecutor({ whitelist: options?.whitelist });
    this.maxActions = options?.maxActions ?? Number(process.env.AGENT_MAX_ACTIONS ?? 30);
    this.maxReplans = options?.maxReplans ?? Number(process.env.AGENT_MAX_REPLANS ?? 5);
    this.artifactDir = options?.artifactDir ?? 'artifacts';
  }

  async run(input: ScenarioInput): Promise<AgentRunResult> {
    if (!input.tags.includes('@ai')) {
      logger.info({ scenario: input.scenarioName }, 'Skipping AI runtime because @ai tag absent');
      return { status: 'skipped', history: [], cachedPlanUsed: false, planPersisted: false };
    }

    const history: AgentHistoryEntry[] = [];
    const executedActions: PlannedAction[] = [];
    const scenarioKey = this.scenarioKey(input);
    const snapshotDir = join(this.artifactDir, scenarioKey);
    await mkdir(snapshotDir, { recursive: true });

    let cachedPlanUsed = false;
    let planPersisted = false;
    let failureReason: string | undefined;
    let replanCount = 0;
    let actionCount = 0;
    let lastObservation: Observation | null = null;
    let lastDelta: ObservationDelta | null = null;

    let cachedQueue: PlannedAction[] = [];
    let candidateQueue: PlannedAction[] = [];
    try {
      const cachedPlan = await this.cache.load(input.featureUri, input.scenarioName);
      if (cachedPlan) {
        cachedQueue = [...cachedPlan.actions];
        cachedPlanUsed = true;
        logger.info({ scenario: input.scenarioName }, 'Replaying cached plan');
      }
    } catch (error) {
      logger.warn({ err: error, scenario: input.scenarioName }, 'Failed to load cached plan');
    }

    while (actionCount < this.maxActions) {
      let plannedAction: PlannedAction | undefined;
      let usedCachedAction = false;
      if (cachedQueue.length > 0) {
        plannedAction = cachedQueue.shift();
        usedCachedAction = true;
      } else {
        if (candidateQueue.length === 0) {
          if (replanCount >= this.maxReplans && executedActions.length > 0) {
            failureReason = failureReason ?? 'Replan budget exhausted';
            break;
          }

          try {
            const planningContext: PlannerContext = {
              scenarioName: input.scenarioName,
              featureName: input.featureName,
              steps: input.steps,
              tags: input.tags,
              previousActions: executedActions,
              observation: lastDelta,
              failure: failureReason,
              remainingActionBudget: this.maxActions - actionCount,
              remainingReplanBudget: this.maxReplans - replanCount,
            };
            const { actions } = await this.planner.proposeAction(planningContext);
            candidateQueue = actions;
            replanCount += 1;
          } catch (error) {
            failureReason = `Planner error: ${(error as Error).message}`;
            break;
          }
        }

        plannedAction = candidateQueue.shift();
      }

      if (!plannedAction) {
        failureReason = failureReason ?? 'Planner returned no action';
        break;
      }

      actionCount += 1;
      const execution = await this.executor.execute(plannedAction.call);
      let observation: Observation | null = null;
      let delta: ObservationDelta | null = null;
      let verificationSuccess = false;
      let error: string | undefined;
      let healed = false;

      if (!execution.success) {
        const healResult = lastObservation
          ? this.healer.attempt(plannedAction.call, lastObservation, execution.error)
          : { healed: false };
        if (healResult.healed && healResult.updatedCall) {
          const healedExecution = await this.executor.execute(healResult.updatedCall);
          healed = healedExecution.success;
          plannedAction = { ...plannedAction, call: healResult.updatedCall };
          if (!healedExecution.success) {
            error = healedExecution.error;
          }
        } else {
          error = execution.error;
        }
      }

      if (!error) {
        const captured = await this.observer.capture();
        observation = captured.observation;
        delta = captured.delta;
        lastObservation = observation;
        lastDelta = delta;

        const verifyResult = this.verifier.verify(plannedAction.expectation, observation);
        verificationSuccess = verifyResult.success;
        if (!verifyResult.success) {
          error = verifyResult.reason;
        }
      }

      const entry: AgentHistoryEntry = {
        action: plannedAction,
        observation: observation ?? lastObservation ?? this.fallbackObservation(),
        delta: delta ?? lastDelta ?? this.fallbackDelta(),
        success: verificationSuccess,
        error,
        healed,
      };
      history.push(entry);
      await this.persistTurn(snapshotDir, history.length, entry);

      if (error) {
        failureReason = error;
        if (usedCachedAction) {
          cachedPlanUsed = false;
          cachedQueue = [];
        }
        candidateQueue = [];
        continue;
      }

      if (usedCachedAction) {
        if (cachedQueue.length === 0) {
          candidateQueue = [];
        }
      } else {
        candidateQueue = [];
      }

      executedActions.push(plannedAction);
    }

    if (!failureReason && executedActions.length > 0) {
      try {
        await this.cache.save(input.featureUri, input.scenarioName, {
          version: 1,
          feature: input.featureUri,
          scenario: input.scenarioName,
          tags: input.tags,
          actions: executedActions,
        });
        planPersisted = true;
      } catch (error) {
        logger.warn({ err: error }, 'Failed to persist cached plan');
      }
    }

    await this.persistHistory(snapshotDir, history);

    if (failureReason) {
      return {
        status: 'failed',
        reason: failureReason,
        history,
        cachedPlanUsed,
        planPersisted,
      };
    }

    if (executedActions.length === 0) {
      return {
        status: 'failed',
        reason: failureReason ?? 'No actions executed',
        history,
        cachedPlanUsed,
        planPersisted,
      };
    }

    return { status: 'passed', history, cachedPlanUsed, planPersisted };
  }

  private scenarioKey(input: ScenarioInput): string {
    const base = `${input.featureUri}-${input.scenarioName}`
      .replace(/[^a-zA-Z0-9_-]+/g, '-')
      .replace(/-+/g, '-');
    return base;
  }

  private async persistTurn(dir: string, index: number, entry: AgentHistoryEntry) {
    const screenshotPath = join(dir, `turn-${index}.png`);
    const jsonPath = join(dir, `turn-${index}.json`);
    await browser.saveScreenshot(screenshotPath);
    await writeFile(jsonPath, JSON.stringify(entry, null, 2), 'utf-8');
  }

  private async persistHistory(dir: string, history: AgentHistoryEntry[]) {
    const historyPath = join(dir, 'history.json');
    await writeFile(historyPath, JSON.stringify(history, null, 2), 'utf-8');
  }

  private fallbackObservation(): Observation {
    return { url: '', title: '', visibleTexts: [], interactiveElements: [], lastToast: null };
  }

  private fallbackDelta(): ObservationDelta {
    return { addedTexts: [], removedTexts: [], interactiveElements: [], urlChanged: false, titleChanged: false, lastToast: null };
  }

}
