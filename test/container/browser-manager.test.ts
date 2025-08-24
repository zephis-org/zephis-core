import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { BrowserManager } from '../../src/container/browser-manager';
import puppeteer from 'puppeteer';

vi.mock('puppeteer');

describe('BrowserManager', () => {
  let browserManager: BrowserManager;
  let mockBrowser: any;
  let mockPage: any;

  beforeEach(() => {
    mockPage = {
      setDefaultTimeout: vi.fn(),
      evaluateOnNewDocument: vi.fn(),
      setExtraHTTPHeaders: vi.fn(),
      goto: vi.fn(),
      waitForSelector: vi.fn(),
      $: vi.fn(),
      evaluate: vi.fn(),
      screenshot: vi.fn(),
      url: vi.fn().mockReturnValue('https://test.com'),
      on: vi.fn()
    };

    mockBrowser = {
      newPage: vi.fn().mockResolvedValue(mockPage),
      close: vi.fn()
    };

    (puppeteer.launch as any).mockResolvedValue(mockBrowser);

    browserManager = new BrowserManager({
      headless: true,
      timeout: 30000
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('createBrowser', () => {
    it('should create a browser instance', async () => {
      const sessionId = 'test-session-123';
      const browser = await browserManager.createBrowser(sessionId);

      expect(browser).toBe(mockBrowser);
      expect(puppeteer.launch).toHaveBeenCalledWith(
        expect.objectContaining({
          headless: true,
          args: expect.arrayContaining(['--no-sandbox'])
        })
      );
      expect(mockBrowser.newPage).toHaveBeenCalled();
      expect(mockPage.setDefaultTimeout).toHaveBeenCalledWith(30000);
    });

    it('should configure page with anti-detection measures', async () => {
      await browserManager.createBrowser('test-session');

      expect(mockPage.evaluateOnNewDocument).toHaveBeenCalled();
      expect(mockPage.setExtraHTTPHeaders).toHaveBeenCalledWith({
        'Accept-Language': 'en-US,en;q=0.9'
      });
    });

    it('should emit browser:created event', async () => {
      const sessionId = 'test-session-123';
      const eventPromise = new Promise(resolve => {
        browserManager.once('browser:created', resolve);
      });

      await browserManager.createBrowser(sessionId);
      const event = await eventPromise;

      expect(event).toEqual({
        sessionId,
        browser: mockBrowser
      });
    });

    it('should handle creation errors', async () => {
      (puppeteer.launch as any).mockRejectedValue(new Error('Launch failed'));

      await expect(browserManager.createBrowser('test-session'))
        .rejects.toThrow('Launch failed');
    });
  });

  describe('navigateTo', () => {
    beforeEach(async () => {
      await browserManager.createBrowser('test-session');
    });

    it('should navigate to URL', async () => {
      await browserManager.navigateTo('test-session', 'https://example.com');

      expect(mockPage.goto).toHaveBeenCalledWith(
        'https://example.com',
        expect.objectContaining({
          waitUntil: 'networkidle2',
          timeout: 30000
        })
      );
    });

    it('should throw error if page not found', async () => {
      await expect(browserManager.navigateTo('invalid-session', 'https://example.com'))
        .rejects.toThrow('No page found for session invalid-session');
    });
  });

  describe('waitForSelector', () => {
    beforeEach(async () => {
      await browserManager.createBrowser('test-session');
    });

    it('should wait for selector', async () => {
      await browserManager.waitForSelector('test-session', '.test-selector', 5000);

      expect(mockPage.waitForSelector).toHaveBeenCalledWith('.test-selector', {
        timeout: 5000
      });
    });

    it('should use default timeout if not provided', async () => {
      await browserManager.waitForSelector('test-session', '.test-selector');

      expect(mockPage.waitForSelector).toHaveBeenCalledWith('.test-selector', {
        timeout: 30000
      });
    });
  });

  describe('extractData', () => {
    beforeEach(async () => {
      await browserManager.createBrowser('test-session');
    });

    it('should extract data from selectors', async () => {
      const mockElement = { textContent: 'Test Value' };
      mockPage.$.mockResolvedValue(mockElement);
      mockPage.evaluate.mockResolvedValue('Test Value');

      const selectors = {
        field1: '.selector1',
        field2: '.selector2'
      };

      const data = await browserManager.extractData('test-session', selectors);

      expect(data).toEqual({
        field1: 'Test Value',
        field2: 'Test Value'
      });
    });

    it('should handle missing elements', async () => {
      mockPage.$.mockResolvedValue(null);

      const selectors = { field1: '.missing' };
      const data = await browserManager.extractData('test-session', selectors);

      expect(data).toEqual({ field1: '' });
    });

    it('should handle extraction errors', async () => {
      mockPage.$.mockRejectedValue(new Error('Selector error'));

      const selectors = { field1: '.error' };
      const data = await browserManager.extractData('test-session', selectors);

      expect(data).toEqual({ field1: '' });
    });
  });

  describe('injectTLSInterceptor', () => {
    beforeEach(async () => {
      await browserManager.createBrowser('test-session');
    });

    it('should inject TLS interceptor', async () => {
      await browserManager.injectTLSInterceptor('test-session');

      expect(mockPage.evaluateOnNewDocument).toHaveBeenCalled();
    });

    it('should throw error if page not found', async () => {
      await expect(browserManager.injectTLSInterceptor('invalid-session'))
        .rejects.toThrow('No page found for session invalid-session');
    });
  });

  describe('destroyBrowser', () => {
    beforeEach(async () => {
      await browserManager.createBrowser('test-session');
    });

    it('should destroy browser', async () => {
      await browserManager.destroyBrowser('test-session');

      expect(mockBrowser.close).toHaveBeenCalled();
      expect(browserManager.getBrowser('test-session')).toBeUndefined();
      expect(browserManager.getPage('test-session')).toBeUndefined();
    });

    it('should emit browser:destroyed event', async () => {
      const eventPromise = new Promise(resolve => {
        browserManager.once('browser:destroyed', resolve);
      });

      await browserManager.destroyBrowser('test-session');
      const event = await eventPromise;

      expect(event).toEqual({ sessionId: 'test-session' });
    });

    it('should handle destroy errors gracefully', async () => {
      mockBrowser.close.mockRejectedValue(new Error('Close failed'));

      await browserManager.destroyBrowser('test-session');
      // Browser is removed from map even if close fails
      expect(browserManager.getBrowser('test-session')).toBeUndefined();
      expect(browserManager.getPage('test-session')).toBeUndefined();
    });
  });

  describe('destroyAll', () => {
    it('should destroy all browsers', async () => {
      await browserManager.createBrowser('session1');
      await browserManager.createBrowser('session2');

      await browserManager.destroyAll();

      expect(browserManager.getBrowser('session1')).toBeUndefined();
      expect(browserManager.getBrowser('session2')).toBeUndefined();
    });
  });

  describe('getters', () => {
    beforeEach(async () => {
      await browserManager.createBrowser('test-session');
    });

    it('should get page by session ID', () => {
      const page = browserManager.getPage('test-session');
      expect(page).toBe(mockPage);
    });

    it('should get browser by session ID', () => {
      const browser = browserManager.getBrowser('test-session');
      expect(browser).toBe(mockBrowser);
    });

    it('should return undefined for invalid session', () => {
      expect(browserManager.getPage('invalid')).toBeUndefined();
      expect(browserManager.getBrowser('invalid')).toBeUndefined();
    });
  });
});