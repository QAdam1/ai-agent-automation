import { ToolCall } from './types.js';

export interface ExecutionResult {
  success: boolean;
  error?: string;
}

export interface ExecutionOptions {
  whitelist?: string[];
}

export class ToolExecutor {
  private readonly whitelist: string[];

  constructor(options?: ExecutionOptions) {
    this.whitelist = options?.whitelist ?? ['http://localhost', 'https://'];
  }

  async execute(call: ToolCall): Promise<ExecutionResult> {
    try {
      switch (call.type) {
        case 'navigate':
          await this.navigate(call);
          break;
        case 'click':
          await this.click(call);
          break;
        case 'fill':
          await this.fill(call);
          break;
        case 'assertText':
          await this.assertText(call);
          break;
        case 'waitFor':
          await this.waitFor(call);
          break;
        case 'pressKey':
          await this.pressKey(call);
          break;
        case 'hover':
          await this.hover(call);
          break;
        default:
          throw new Error(`Unsupported tool type: ${call.type}`);
      }
      return { success: true };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  }

  private async navigate(call: ToolCall) {
    const target = call.target ?? call.value;
    if (!target) {
      throw new Error('Navigate call missing target');
    }
    if (!this.whitelist.some((allowed) => target.startsWith(allowed))) {
      throw new Error(`Navigation target not in whitelist: ${target}`);
    }
    await browser.url(target);
  }

  private async click(call: ToolCall) {
    const element = await this.resolveElement(call.target);
    await element.click();
  }

  private async hover(call: ToolCall) {
    const element = await this.resolveElement(call.target);
    await element.moveTo();
  }

  private async fill(call: ToolCall) {
    const element = await this.resolveElement(call.target);
    await element.waitForEnabled({ timeout: 10000 });
    await element.setValue(call.value ?? '');
  }

  private async waitFor(call: ToolCall) {
    const element = await this.resolveElement(call.target);
    await element.waitForDisplayed({ timeout: 10000 });
  }

  private async pressKey(call: ToolCall) {
    if (!call.value) {
      throw new Error('pressKey requires value');
    }
    await browser.keys(call.value.split(',').map((token) => token.trim()));
  }

  private async assertText(call: ToolCall) {
    if (!call.target && !call.value) {
      throw new Error('assertText requires target or value');
    }
    const expectation = call.value ?? call.target ?? '';
    const body = await browser.$('body');
    const text = await body.getText();
    if (!text.includes(expectation)) {
      throw new Error(`Expected page to contain \"${expectation}\"`);
    }
  }

  async resolveElement(target?: string) {
    if (!target) {
      throw new Error('No target provided');
    }
    let selector = target;
    if (target.startsWith('text=')) {
      const textSelector = target.replace(/^text=/, '');
      const escaped = textSelector.replace(/"/g, '\"');
      selector = `//*[contains(normalize-space(.), "${escaped}")]`;
    } else if (target.startsWith('data-testid=')) {
      const testId = target.replace(/^data-testid=/, '');
      const escaped = testId.replace(/"/g, '\"');
      selector = `//*[@data-testid="${escaped}"]`;
    }
    const element = await browser.$(selector);
    await element.waitForExist({ timeout: 10000 });
    return element;
  }
}

