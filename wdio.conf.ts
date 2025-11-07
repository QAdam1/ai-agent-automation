import type { Options } from '@wdio/types';

const tagExpression = process.env.CUCUMBER_TAG_EXPRESSION ?? '';

export const config: Options.Testrunner = {
  runner: 'local',
  specs: ['./features/**/*.feature'],
  maxInstances: 1,
  logLevel: process.env.WDIO_LOG_LEVEL ?? 'info',
  bail: 0,
  baseUrl: process.env.BASE_URL ?? 'http://localhost:3000',
  waitforTimeout: 15000,
  connectionRetryTimeout: 120000,
  connectionRetryCount: 1,
  services: ['devtools'],
  framework: 'cucumber',
  reporters: ['spec'],
  cucumberOpts: {
    require: ['./src/support/**/*.ts'],
    requireModule: ['ts-node/register'],
    backtrace: false,
    dryRun: false,
    failAmbiguousDefinitions: false,
    timeout: 60000,
    ignoreUndefinedDefinitions: false,
    tagExpression,
  },
  capabilities: [
    {
      browserName: 'chrome',
      'wdio:devtoolsOptions': {
        headless: process.env.HEADLESS !== 'false',
      },
      acceptInsecureCerts: true,
    },
  ],
  async before() {
    await browser.setWindowSize(1280, 800);
  },
};
