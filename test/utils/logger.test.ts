import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Logger, LogLevel } from '../../src/utils/logger';

describe('Logger', () => {
  let logger: Logger;
  let testHandler: any;

  beforeEach(() => {
    logger = Logger.getInstance();
    testHandler = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    // Reset logger state
    logger.setLevel(LogLevel.INFO);
    // Remove test handler if it was added
    logger.removeHandler(testHandler);
  });

  describe('singleton pattern', () => {
    it('should return same instance', () => {
      const logger1 = Logger.getInstance();
      const logger2 = Logger.getInstance();
      expect(logger1).toBe(logger2);
    });
  });

  describe('log levels', () => {
    it('should respect log level filtering', () => {
      logger.addHandler(testHandler);
      logger.setLevel(LogLevel.WARN);
      
      logger.debug('Debug message');
      logger.info('Info message');
      logger.warn('Warning message');
      logger.error('Error message');

      // Should only have called handler for WARN and ERROR
      expect(testHandler).toHaveBeenCalledTimes(2);
      expect(testHandler).toHaveBeenCalledWith(expect.objectContaining({
        level: LogLevel.WARN,
        message: 'Warning message'
      }));
      expect(testHandler).toHaveBeenCalledWith(expect.objectContaining({
        level: LogLevel.ERROR,
        message: 'Error message'
      }));
    });

    it('should log all levels when set to DEBUG', () => {
      logger.addHandler(testHandler);
      logger.setLevel(LogLevel.DEBUG);
      
      logger.debug('Debug message');
      logger.info('Info message');
      logger.warn('Warning message');
      logger.error('Error message');

      expect(testHandler).toHaveBeenCalledTimes(4);
      expect(testHandler).toHaveBeenCalledWith(expect.objectContaining({
        level: LogLevel.DEBUG,
        message: 'Debug message'
      }));
      expect(testHandler).toHaveBeenCalledWith(expect.objectContaining({
        level: LogLevel.INFO,
        message: 'Info message'
      }));
    });

    it('should determine log level from environment', () => {
      // This tests the private getLogLevelFromEnv method indirectly
      const originalEnv = process.env.LOG_LEVEL;
      
      process.env.LOG_LEVEL = 'DEBUG';
      // Create a new instance to test environment reading
      const testLogger = new (Logger as any)();
      testLogger.addHandler(testHandler);
      testLogger.debug('Should log at DEBUG level');
      
      expect(testHandler).toHaveBeenCalledWith(expect.objectContaining({
        level: LogLevel.DEBUG,
        message: 'Should log at DEBUG level'
      }));
      
      process.env.LOG_LEVEL = originalEnv;
    });
  });

  describe('logging methods', () => {
    beforeEach(() => {
      logger.addHandler(testHandler);
      logger.setLevel(LogLevel.DEBUG); // Allow all logs
    });

    it('should format log messages correctly', () => {
      logger.info('Test message');
      
      expect(testHandler).toHaveBeenCalledWith(expect.objectContaining({
        level: LogLevel.INFO,
        message: 'Test message',
        timestamp: expect.any(Date)
      }));
    });

    it('should include context in log messages', () => {
      const context = { sessionId: 'test-123', userId: 'user-456' };
      logger.info('Test message', context);
      
      expect(testHandler).toHaveBeenCalledWith(expect.objectContaining({
        level: LogLevel.INFO,
        message: 'Test message',
        context: context
      }));
    });

    it('should include error details in log messages', () => {
      const error = new Error('Test error');
      error.stack = 'Error: Test error\n    at test.js:1:1';
      
      logger.error('Error occurred', {}, error);
      
      expect(testHandler).toHaveBeenCalledWith(expect.objectContaining({
        level: LogLevel.ERROR,
        message: 'Error occurred',
        error: error
      }));
    });
  });

  describe('custom handlers', () => {
    it('should support adding custom log handlers', () => {
      const customHandler = vi.fn();
      logger.addHandler(customHandler);
      
      logger.info('Test message');
      
      expect(customHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          level: LogLevel.INFO,
          message: 'Test message'
        })
      );
    });

    it('should support removing log handlers', () => {
      const customHandler = vi.fn();
      logger.addHandler(customHandler);
      logger.removeHandler(customHandler);
      
      logger.info('Test message');
      
      expect(customHandler).not.toHaveBeenCalled();
    });

    it('should handle errors in log handlers gracefully', () => {
      const faultyHandler = vi.fn().mockImplementation(() => {
        throw new Error('Handler error');
      });
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      
      logger.addHandler(faultyHandler);
      
      // This should not throw even if handler throws
      expect(() => logger.info('Test message')).not.toThrow();
    });
  });

  describe('specialized logging methods', () => {
    beforeEach(() => {
      logger.addHandler(testHandler);
      logger.setLevel(LogLevel.DEBUG);
    });

    it('should log TLS handshake events', () => {
      logger.logTLSHandshake('session-123', 'TLS_RSA_WITH_AES_128_CBC_SHA', true);
      
      expect(testHandler).toHaveBeenCalledWith(expect.objectContaining({
        level: LogLevel.INFO,
        message: expect.stringContaining('TLS handshake completed')
      }));
    });

    it('should log successful key extraction', () => {
      logger.logKeyExtraction('session-123', true);
      
      expect(testHandler).toHaveBeenCalledWith(expect.objectContaining({
        level: LogLevel.INFO,
        message: expect.stringContaining('Session keys extracted successfully')
      }));
    });

    it('should log failed key extraction', () => {
      const error = new Error('Extraction failed');
      logger.logKeyExtraction('session-123', false, error);
      
      expect(testHandler).toHaveBeenCalledWith(expect.objectContaining({
        level: LogLevel.ERROR,
        message: expect.stringContaining('Session key extraction failed'),
        error: error
      }));
    });

    it('should log successful proof generation', () => {
      logger.logProofGeneration('handshake', 'session-123', 1500, true);
      
      expect(testHandler).toHaveBeenCalledWith(expect.objectContaining({
        level: LogLevel.INFO,
        message: expect.stringContaining('handshake proof generated successfully')
      }));
    });

    it('should log failed proof generation', () => {
      const error = new Error('Proof failed');
      logger.logProofGeneration('session', 'session-123', 500, false, error);
      
      expect(testHandler).toHaveBeenCalledWith(expect.objectContaining({
        level: LogLevel.ERROR,
        message: expect.stringContaining('session proof generation failed'),
        error: error
      }));
    });

    it('should log successful chain submission', () => {
      const txHash = '0x123456789abcdef';
      const gasUsed = BigInt(300000);
      
      logger.logChainSubmission(txHash, gasUsed, true);
      
      expect(testHandler).toHaveBeenCalledWith(expect.objectContaining({
        level: LogLevel.INFO,
        message: expect.stringContaining('Proof submitted to blockchain successfully')
      }));
    });

    it('should log failed chain submission', () => {
      const error = new Error('Submission failed');
      logger.logChainSubmission('0x123', BigInt(0), false, error);
      
      expect(testHandler).toHaveBeenCalledWith(expect.objectContaining({
        level: LogLevel.ERROR,
        message: expect.stringContaining('Blockchain submission failed'),
        error: error
      }));
    });

    it('should log security events', () => {
      const context = { attemptedAction: 'unauthorized_access' };
      
      logger.logSecurity('Unauthorized access attempt detected', 'warn', context);
      
      expect(testHandler).toHaveBeenCalledWith(expect.objectContaining({
        level: LogLevel.WARN,
        message: expect.stringContaining('SECURITY: Unauthorized access attempt detected'),
        context: expect.objectContaining({ 
          security: true,
          component: 'Security',
          attemptedAction: 'unauthorized_access'
        })
      }));
    });

    it('should handle different security log levels', () => {
      logger.logSecurity('Info message', 'info');
      logger.logSecurity('Warning message', 'warn');
      logger.logSecurity('Error message', 'error');
      
      expect(testHandler).toHaveBeenCalledWith(expect.objectContaining({
        level: LogLevel.INFO,
        message: expect.stringContaining('SECURITY: Info message')
      }));
      expect(testHandler).toHaveBeenCalledWith(expect.objectContaining({
        level: LogLevel.WARN,
        message: expect.stringContaining('SECURITY: Warning message')
      }));
      expect(testHandler).toHaveBeenCalledWith(expect.objectContaining({
        level: LogLevel.ERROR,
        message: expect.stringContaining('SECURITY: Error message')
      }));
    });
  });

  describe('test environment handling', () => {
    it('should work with test handlers in test environment', () => {
      // The default console handler doesn't log in test env, but custom handlers should work
      logger.addHandler(testHandler);
      logger.info('Test message');
      
      expect(testHandler).toHaveBeenCalledWith(expect.objectContaining({
        message: 'Test message'
      }));
    });
  });

  describe('log entry structure', () => {
    beforeEach(() => {
      logger.addHandler(testHandler);
    });

    it('should create proper log entry structure', () => {
      const context = { key: 'value' };
      const error = new Error('Test error');
      logger.error('Test message', context, error);
      
      expect(testHandler).toHaveBeenCalledWith({
        timestamp: expect.any(Date),
        level: LogLevel.ERROR,
        message: 'Test message',
        context,
        error
      });
    });

    it('should handle undefined context and error', () => {
      logger.info('Simple message');
      
      expect(testHandler).toHaveBeenCalledWith({
        timestamp: expect.any(Date),
        level: LogLevel.INFO,
        message: 'Simple message',
        context: undefined,
        error: undefined
      });
    });
  });

  describe('log level enum', () => {
    it('should have correct log level values', () => {
      expect(LogLevel.DEBUG).toBe(0);
      expect(LogLevel.INFO).toBe(1);
      expect(LogLevel.WARN).toBe(2);
      expect(LogLevel.ERROR).toBe(3);
    });

    it('should convert log level to string correctly', () => {
      expect(LogLevel[LogLevel.DEBUG]).toBe('DEBUG');
      expect(LogLevel[LogLevel.INFO]).toBe('INFO');
      expect(LogLevel[LogLevel.WARN]).toBe('WARN');
      expect(LogLevel[LogLevel.ERROR]).toBe('ERROR');
    });
  });

  describe('performance', () => {
    it('should not process logs below threshold', () => {
      let expensiveCallCount = 0;
      const expensiveContext = () => {
        expensiveCallCount++;
        return { computed: Math.random() };
      };
      
      logger.addHandler(testHandler);
      logger.setLevel(LogLevel.ERROR);
      
      // This should not process since DEBUG is below threshold
      logger.debug('Debug message', expensiveContext());
      
      // Only the error log should be processed
      logger.error('Error message');
      
      expect(testHandler).toHaveBeenCalledTimes(1);
      expect(testHandler).toHaveBeenCalledWith(expect.objectContaining({
        level: LogLevel.ERROR,
        message: 'Error message'
      }));
    });
  });

  describe('timestamp handling', () => {
    it('should include timestamp in log entries', () => {
      logger.addHandler(testHandler);
      
      const beforeTime = new Date();
      logger.info('Test message');
      const afterTime = new Date();
      
      const logEntry = testHandler.mock.calls[0][0];
      expect(logEntry.timestamp).toBeInstanceOf(Date);
      expect(logEntry.timestamp.getTime()).toBeGreaterThanOrEqual(beforeTime.getTime());
      expect(logEntry.timestamp.getTime()).toBeLessThanOrEqual(afterTime.getTime());
    });
  });

  describe('handler management', () => {
    it('should handle multiple handlers', () => {
      const handler1 = vi.fn();
      const handler2 = vi.fn();
      
      logger.addHandler(handler1);
      logger.addHandler(handler2);
      
      logger.info('Test message');
      
      expect(handler1).toHaveBeenCalledTimes(1);
      expect(handler2).toHaveBeenCalledTimes(1);
      
      logger.removeHandler(handler1);
      logger.removeHandler(handler2);
    });

    it('should handle removing non-existent handler', () => {
      const handler = vi.fn();
      
      // Should not throw when removing handler that was never added
      expect(() => logger.removeHandler(handler)).not.toThrow();
    });
  });
});