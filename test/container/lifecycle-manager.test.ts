import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { LifecycleManager } from '../../src/container/lifecycle-manager';
import { SessionStatus } from '../../src/types';

vi.mock('uuid', () => ({
  v4: vi.fn(() => 'test-session-id')
}));

vi.mock('../../src/container/browser-manager', () => {
  const EventEmitter = require('events').EventEmitter;
  class MockBrowserManager extends EventEmitter {
    createBrowser = vi.fn().mockResolvedValue(undefined);
    destroyBrowser = vi.fn().mockResolvedValue(undefined);
    navigateTo = vi.fn().mockResolvedValue(undefined);
    extractData = vi.fn().mockResolvedValue({});
    getPage = vi.fn().mockReturnValue({
      url: vi.fn().mockReturnValue('https://example.com/dashboard')
    });
  }
  return { BrowserManager: MockBrowserManager };
});

vi.mock('../../src/container/isolation-manager', () => {
  const EventEmitter = require('events').EventEmitter;
  class MockIsolationManager extends EventEmitter {
    createContainer = vi.fn().mockResolvedValue({
      id: 'container-123'
    });
    destroyContainer = vi.fn().mockResolvedValue(undefined);
  }
  return { IsolationManager: MockIsolationManager };
});

vi.mock('../../src/utils/logger', () => ({
  default: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn()
  }
}));

describe('LifecycleManager', () => {
  let lifecycleManager: LifecycleManager;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    lifecycleManager = new LifecycleManager();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('createSession', () => {
    it('should create a new session successfully', async () => {
      const sessionPromise = lifecycleManager.createSession();
      
      // Fast-forward the 5-second wait
      await vi.advanceTimersByTimeAsync(5000);
      
      const session = await sessionPromise;

      expect(session).toMatchObject({
        id: 'test-session-id',
        containerId: 'container-123',
        status: SessionStatus.READY,
        createdAt: expect.any(Date),
        expiresAt: expect.any(Date)
      });
    });
  });

  describe('getSession', () => {
    it('should return existing session', async () => {
      const sessionPromise = lifecycleManager.createSession();
      await vi.advanceTimersByTimeAsync(5000);
      await sessionPromise;

      const session = await lifecycleManager.getSession('test-session-id');
      expect(session).toBeDefined();
      expect(session?.id).toBe('test-session-id');
    });

    it('should return undefined for non-existent session', async () => {
      const session = await lifecycleManager.getSession('non-existent');
      expect(session).toBeUndefined();
    });
  });

  describe('destroySession', () => {
    it('should destroy session and cleanup resources', async () => {
      const sessionPromise = lifecycleManager.createSession();
      await vi.advanceTimersByTimeAsync(5000);
      await sessionPromise;

      await lifecycleManager.destroySession('test-session-id');
      
      const session = await lifecycleManager.getSession('test-session-id');
      expect(session).toBeUndefined();
    });
  });

  describe('getActiveSessions', () => {
    it('should return all active sessions', async () => {
      const sessionPromise = lifecycleManager.createSession();
      await vi.advanceTimersByTimeAsync(5000);
      await sessionPromise;

      const sessions = lifecycleManager.getActiveSessions();
      expect(sessions).toHaveLength(1);
      expect(sessions[0].id).toBe('test-session-id');
    });

    it('should return empty array when no sessions', () => {
      const sessions = lifecycleManager.getActiveSessions();
      expect(sessions).toHaveLength(0);
    });
  });

  describe('getSessionCount', () => {
    it('should return correct session count', async () => {
      expect(lifecycleManager.getSessionCount()).toBe(0);

      const sessionPromise = lifecycleManager.createSession();
      await vi.advanceTimersByTimeAsync(5000);
      await sessionPromise;

      expect(lifecycleManager.getSessionCount()).toBe(1);
    });
  });

  describe('navigateToTarget', () => {
    it('should navigate browser to URL', async () => {
      const sessionPromise = lifecycleManager.createSession();
      await vi.advanceTimersByTimeAsync(5000);
      await sessionPromise;

      await lifecycleManager.navigateToTarget('test-session-id', 'https://example.com');
      // Test passes if no error thrown
    });

    it('should throw error for non-existent session', async () => {
      await expect(
        lifecycleManager.navigateToTarget('non-existent', 'https://example.com')
      ).rejects.toThrow('Session');
    });
  });

  describe('capturePageData', () => {
    it('should capture data from page', async () => {
      const sessionPromise = lifecycleManager.createSession();
      await vi.advanceTimersByTimeAsync(5000);
      await sessionPromise;

      const selectors = {
        balance: '.balance',
        username: '.username'
      };

      const result = await lifecycleManager.capturePageData('test-session-id', selectors);
      expect(result).toBeDefined();
    });
  });
});