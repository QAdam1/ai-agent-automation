import { AgentRuntime } from './agent-runtime.js';

let runtime: AgentRuntime | null = null;

function parseWhitelist(): string[] | undefined {
  const raw = process.env.AGENT_URL_WHITELIST;
  if (!raw) {
    return undefined;
  }
  return raw.split(',').map((entry) => entry.trim()).filter(Boolean);
}

export function getAgentRuntime(): AgentRuntime {
  if (!runtime) {
    runtime = new AgentRuntime({ whitelist: parseWhitelist() });
  }
  return runtime;
}
