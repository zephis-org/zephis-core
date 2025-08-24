export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
}

export interface LogEntry {
  timestamp: Date;
  level: LogLevel;
  message: string;
  context: Record<string, any> | undefined;
  error: Error | undefined;
}

export class Logger {
  private static instance: Logger;
  private level: LogLevel;
  private logHandlers: Array<(entry: LogEntry) => void> = [];

  private constructor() {
    this.level = this.getLogLevelFromEnv();
    this.setupDefaultHandlers();
  }

  public static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger();
    }
    return Logger.instance;
  }

  private getLogLevelFromEnv(): LogLevel {
    const envLevel = process.env.LOG_LEVEL?.toUpperCase();
    switch (envLevel) {
      case 'DEBUG': return LogLevel.DEBUG;
      case 'INFO': return LogLevel.INFO;
      case 'WARN': return LogLevel.WARN;
      case 'ERROR': return LogLevel.ERROR;
      default: return LogLevel.INFO;
    }
  }

  private setupDefaultHandlers(): void {
    // Console handler
    this.addHandler((entry: LogEntry) => {
      if (process.env.NODE_ENV === 'test') return;

      const timestamp = entry.timestamp.toISOString();
      const level = LogLevel[entry.level];
      const context = entry.context ? ` ${JSON.stringify(entry.context)}` : '';
      
      let logMessage = `[${timestamp}] ${level}: ${entry.message}${context}`;
      
      if (entry.error) {
        logMessage += `\nError: ${entry.error.message}\nStack: ${entry.error.stack}`;
      }

      switch (entry.level) {
        case LogLevel.DEBUG:
        case LogLevel.INFO:
          console.log(logMessage);
          break;
        case LogLevel.WARN:
          console.warn(logMessage);
          break;
        case LogLevel.ERROR:
          console.error(logMessage);
          break;
      }
    });
  }

  public setLevel(level: LogLevel): void {
    this.level = level;
  }

  public addHandler(handler: (entry: LogEntry) => void): void {
    this.logHandlers.push(handler);
  }

  public removeHandler(handler: (entry: LogEntry) => void): void {
    const index = this.logHandlers.indexOf(handler);
    if (index > -1) {
      this.logHandlers.splice(index, 1);
    }
  }

  private log(level: LogLevel, message: string, context?: Record<string, any>, error?: Error): void {
    if (level < this.level) return;

    const entry: LogEntry = {
      timestamp: new Date(),
      level,
      message,
      context,
      error,
    };

    this.logHandlers.forEach(handler => {
      try {
        handler(entry);
      } catch (handlerError) {
        // Prevent logging errors from breaking the application
        console.error('Log handler error:', handlerError);
      }
    });
  }

  public debug(message: string, context?: Record<string, any>): void {
    this.log(LogLevel.DEBUG, message, context);
  }

  public info(message: string, context?: Record<string, any>): void {
    this.log(LogLevel.INFO, message, context);
  }

  public warn(message: string, context?: Record<string, any>): void {
    this.log(LogLevel.WARN, message, context);
  }

  public error(message: string, context?: Record<string, any>, error?: Error): void {
    this.log(LogLevel.ERROR, message, context, error);
  }

  // Specialized logging methods for ZEPHIS operations
  public logTLSHandshake(sessionId: string, cipherSuite: string, success: boolean): void {
    this.info('TLS handshake completed', {
      sessionId,
      cipherSuite,
      success,
      component: 'HandshakeCapture'
    });
  }

  public logKeyExtraction(sessionId: string, success: boolean, error?: Error): void {
    if (success) {
      this.info('Session keys extracted successfully', {
        sessionId,
        component: 'KeyExtraction'
      });
    } else {
      this.error('Session key extraction failed', {
        sessionId,
        component: 'KeyExtraction'
      }, error);
    }
  }

  public logProofGeneration(
    proofType: 'handshake' | 'session' | 'data',
    sessionId: string,
    duration: number,
    success: boolean,
    error?: Error
  ): void {
    if (success) {
      this.info(`${proofType} proof generated successfully`, {
        sessionId,
        proofType,
        duration,
        component: 'ProofGeneration'
      });
    } else {
      this.error(`${proofType} proof generation failed`, {
        sessionId,
        proofType,
        duration,
        component: 'ProofGeneration'
      }, error);
    }
  }

  public logChainSubmission(
    transactionHash: string,
    gasUsed: bigint,
    success: boolean,
    error?: Error
  ): void {
    if (success) {
      this.info('Proof submitted to blockchain successfully', {
        transactionHash,
        gasUsed: gasUsed.toString(),
        component: 'ChainSubmitter'
      });
    } else {
      this.error('Blockchain submission failed', {
        transactionHash,
        component: 'ChainSubmitter'
      }, error);
    }
  }

  public logSecurity(message: string, level: 'info' | 'warn' | 'error', context?: Record<string, any>): void {
    const securityContext = {
      ...context,
      security: true,
      component: 'Security'
    };

    switch (level) {
      case 'info':
        this.info(`SECURITY: ${message}`, securityContext);
        break;
      case 'warn':
        this.warn(`SECURITY: ${message}`, securityContext);
        break;
      case 'error':
        this.error(`SECURITY: ${message}`, securityContext);
        break;
    }
  }
}

// Export singleton instance
export const logger = Logger.getInstance();