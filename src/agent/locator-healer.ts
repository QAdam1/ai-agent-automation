import { Observation, ToolCall } from './types.js';

export interface HealResult {
  healed: boolean;
  updatedCall?: ToolCall;
  message?: string;
}

export class LocatorHealer {
  attempt(call: ToolCall, observation: Observation, error?: string): HealResult {
    if (!call.target) {
      return { healed: false };
    }

    if (call.target.startsWith('text=') || call.target.startsWith('data-testid=')) {
      return { healed: false };
    }

    const candidateText = this.selectCandidateText(call, observation);
    if (candidateText) {
      return {
        healed: true,
        updatedCall: { ...call, target: `text=${candidateText}` },
        message: 'Fell back to text locator based on observation snapshot',
      };
    }

    if (call.target.includes('#')) {
      const dataTestId = call.target.replace('#', '');
      return {
        healed: true,
        updatedCall: { ...call, target: `data-testid=${dataTestId}` },
        message: 'Converted id selector into data-testid locator',
      };
    }

    if (error && /element .*not found/i.test(error)) {
      return {
        healed: true,
        updatedCall: { ...call, target: `${call.target}:not([disabled])` },
        message: 'Appended :not([disabled]) for stale disabled element',
      };
    }

    return { healed: false };
  }

  private selectCandidateText(call: ToolCall, observation: Observation): string | null {
    const expectation = call.expectation ?? call.value ?? call.description ?? '';
    if (expectation) {
      const match = observation.visibleTexts.find((text) =>
        text.toLowerCase().includes(expectation.toLowerCase()),
      );
      if (match) {
        return match;
      }
    }

    const tokens = call.target?.split(/[^a-zA-Z0-9]+/g).filter(Boolean) ?? [];
    for (const token of tokens) {
      const match = observation.visibleTexts.find((text) =>
        text.toLowerCase().includes(token.toLowerCase()),
      );
      if (match) {
        return match;
      }
    }

    return null;
  }
}
