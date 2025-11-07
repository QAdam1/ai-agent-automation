import { Observation } from './types.js';

export interface VerificationResult {
  success: boolean;
  reason?: string;
}

export class ExpectationVerifier {
  verify(expectation: string, observation: Observation): VerificationResult {
    if (!expectation) {
      return { success: true };
    }

    const haystacks = [
      observation.title,
      observation.visibleTexts.join(' \n '),
      observation.interactiveElements.join(' \n '),
      observation.lastToast ?? '',
    ]
      .filter(Boolean)
      .map((entry) => entry.toLowerCase());

    const match = haystacks.some((entry) => entry.includes(expectation.toLowerCase()));
    if (match) {
      return { success: true };
    }

    return {
      success: false,
      reason: `Expectation \"${expectation}\" not found in latest observation`,
    };
  }
}
