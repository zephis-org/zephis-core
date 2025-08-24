import { vi } from 'vitest';
import dotenv from 'dotenv';

// Load test environment variables
dotenv.config({ path: '.env.test' });

// Set test environment
process.env.NODE_ENV = 'test';
process.env.LOG_LEVEL = 'error';

// Mock logger to suppress console output during tests
vi.mock('../src/utils/logger', () => ({
  default: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn()
  }
}));

// Mock external dependencies
vi.mock('dockerode');
vi.mock('puppeteer');
vi.mock('snarkjs', () => ({
  default: {
    groth16: {
      fullProve: vi.fn(),
      verify: vi.fn()
    }
  }
}));
vi.mock('ws');

// Global test utilities
global.testUtils = {
  generateMockSession: () => ({
    id: 'test-session-123',
    containerId: 'container-123',
    browserUrl: 'http://localhost:6080',
    vncUrl: 'vnc://localhost:5900',
    status: 'READY',
    createdAt: new Date(),
    expiresAt: new Date(Date.now() + 600000)
  }),
  
  generateMockTemplate: () => ({
    domain: 'test.com',
    name: 'Test Template',
    version: '1.0.0',
    selectors: {
      testField: '.test-selector'
    },
    extractors: {
      testExtractor: '() => true'
    }
  }),
  
  generateMockProof: () => ({
    proof: {
      a: ['1', '2'],
      b: [['3', '4'], ['5', '6']],
      c: ['7', '8']
    },
    publicInputs: ['1', '0'],
    metadata: {
      sessionId: 'test-session-123',
      template: 'test-template',
      claim: 'test-claim',
      timestamp: Date.now(),
      domain: 'test.com',
      circuitId: 'test-circuit'
    }
  })
};

// Clean up after tests
afterAll(() => {
  vi.clearAllMocks();
  vi.resetAllMocks();
});