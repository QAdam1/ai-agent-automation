import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { CachedPlan } from './types.js';

export class PlanCache {
  constructor(private readonly rootDir: string) {}

  async load(featureUri: string, scenarioName: string): Promise<CachedPlan | null> {
    const path = this.resolvePath(featureUri, scenarioName);
    try {
      const contents = await readFile(path, 'utf-8');
      const parsed = JSON.parse(contents) as CachedPlan;
      return parsed;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return null;
      }
      throw error;
    }
  }

  async save(featureUri: string, scenarioName: string, payload: Omit<CachedPlan, 'createdAt'>) {
    const path = this.resolvePath(featureUri, scenarioName);
    await mkdir(dirname(path), { recursive: true });
    const data: CachedPlan = {
      ...payload,
      createdAt: new Date().toISOString(),
    };
    await writeFile(path, JSON.stringify(data, null, 2), 'utf-8');
  }

  private resolvePath(featureUri: string, scenarioName: string): string {
    const sanitizedUri = featureUri.replace(/[^a-zA-Z0-9/_-]+/g, '-');
    const sanitizedScenario = scenarioName.replace(/[^a-zA-Z0-9_-]+/g, '-');
    return `${this.rootDir}/${sanitizedUri}.${sanitizedScenario}.plan.json`;
  }

  static fromFeaturesRoot(): PlanCache {
    return new PlanCache('features/.plans');
  }
}
