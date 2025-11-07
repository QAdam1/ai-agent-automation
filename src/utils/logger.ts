import pino from 'pino';

export type LogLevel = 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'fatal';

export const logger = pino({
  name: 'ai-agent-automation',
  level: (process.env.LOG_LEVEL as LogLevel) ?? 'info',
  transport:
    process.env.NODE_ENV === 'test'
      ? undefined
      : {
          target: 'pino-pretty',
          options: {
            colorize: true,
            translateTime: 'SYS:standard',
          },
        },
});

export type Logger = typeof logger;
