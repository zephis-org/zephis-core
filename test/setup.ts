import { beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import * as crypto from 'crypto';

// Global test setup
beforeAll(async () => {
  // Initialize any global test dependencies
  console.log('🧪 Setting up ZEPHIS Core tests...');
  
  // Ensure crypto is available for tests
  if (!crypto.constants) {
    throw new Error('Crypto module not properly initialized');
  }
  
  // Set test environment variables
  process.env.NODE_ENV = 'test';
  process.env.LOG_LEVEL = 'error'; // Suppress logs during tests
});

afterAll(async () => {
  // Clean up global resources
  console.log('🧹 Cleaning up ZEPHIS Core tests...');
});

beforeEach(() => {
  // Reset any global state before each test
});

afterEach(() => {
  // Clean up after each test
});

// Global test utilities
declare global {
  var generateTestBuffer: (size: number) => Buffer;
  var generateTestPrivateKey: () => string;
  var generateTestSessionId: () => string;
}

globalThis.generateTestBuffer = (size: number): Buffer => {
  return crypto.randomBytes(size);
};

globalThis.generateTestPrivateKey = (): string => {
  return crypto.randomBytes(32).toString('hex');
};

globalThis.generateTestSessionId = (): string => {
  return `test-session-${crypto.randomUUID()}`;
};

// Mock console methods in test environment
if (process.env.NODE_ENV === 'test') {
  const originalWarn = console.warn;
  const originalError = console.error;
  
  console.warn = (...args: any[]) => {
    if (process.env.DEBUG_TESTS) {
      originalWarn(...args);
    }
  };
  
  console.error = (...args: any[]) => {
    if (process.env.DEBUG_TESTS) {
      originalError(...args);
    }
  };
}