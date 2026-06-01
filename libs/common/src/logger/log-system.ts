import { transports, format, createLogger } from 'winston';
import { utilities, WinstonModule } from 'nest-winston';
import DailyRotateFile from 'winston-daily-rotate-file';
// import * as Sentry from '@sentry/node';

export type AnalysisType = {
  nid?: string;
  userId?: number;
  contents?: any;
};

export class LogSystem {
  static systemLogger: any;
  static analysisLogger: any;
  static requestLogger: any;

  static init(labelName: string): void {
    // LogSystem.initSentry();
    if (process.env.NODE_ENV === 'test') {
      return;
    }

    LogSystem.initSystem(labelName);
    LogSystem.initAnalysis(labelName);
    LogSystem.initRequest(labelName);
  }

  static initSystem(labelName: string): void {
    const { combine, label, timestamp, json } = format;
    const transportsList = [];
    transportsList.push(
      new transports.Console({
        level: 'info',
        format: combine(
          timestamp(),
          utilities.format.nestLike(undefined, {
            colors: true,
          }),
        ),
      }),
    );

    labelName = `[${process.env.NODE_ENV}-${labelName}]`;

    transportsList.push(
      new transports.DailyRotateFile({
        filename: 'errors.log',
        dirname: process.env.LOG_DIRECTORY,
        level: 'error',
        handleExceptions: true,
        format: combine(label({ label: labelName }), timestamp(), json()),
      }),
    );

    LogSystem.systemLogger = WinstonModule.createLogger({
      transports: transportsList,
    });
  }

  // static initSentry(): void {
  //   Sentry.init({
  //     dsn: process.env.SENTRY_DSN,
  //     environment: process.env.NODE_ENV,
  //   });
  // }

  static initAnalysis(labelName: string): void {
    const customLevel = {
      analysis: 0,
    };

    const { combine, label, timestamp, json } = format;

    LogSystem.analysisLogger = createLogger({
      levels: customLevel,
      transports: [
        new DailyRotateFile({
          filename: 'analysis.log',
          dirname: process.env.LOG_DIRECTORY,
          level: 'analysis',
          format: combine(
            label({ label: `[${process.env.NODE_ENV}-${labelName}]` }),
            timestamp(),
            json(),
          ),
        }),
      ],
    });
  }

  static initRequest(labelName: string): void {
    const customLevel = {
      request: 0,
    };

    const { combine, label, timestamp, json } = format;

    LogSystem.requestLogger = createLogger({
      levels: customLevel,
      transports: [
        new DailyRotateFile({
          filename: 'request.log',
          dirname: process.env.LOG_DIRECTORY,
          level: 'request',
          format: combine(
            label({ label: `[${process.env.NODE_ENV}-${labelName}]` }),
            timestamp(),
            json(),
          ),
        }),
      ],
    });
  }

  static analysis(collection: string, analysis?: AnalysisType): void {
    if (!LogSystem.analysisLogger) return;
    LogSystem.analysisLogger.log('analysis', {
      collections: collection,
      ...analysis,
    });
  }

  static request(api: string, analysis?: AnalysisType): void {
    if (!LogSystem.requestLogger) return;
    LogSystem.requestLogger.log('request', {
      api: api,
      ...analysis,
    });
  }
}
