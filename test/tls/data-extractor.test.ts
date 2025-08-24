import { describe, it, expect, beforeEach, vi } from 'vitest';
import { DataExtractor } from '../../src/tls/data-extractor';
import { Page } from 'puppeteer';

vi.mock('../../src/utils/logger', () => ({
  default: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn()
  }
}));

describe('DataExtractor', () => {
  let dataExtractor: DataExtractor;
  let mockPage: any;

  beforeEach(() => {
    vi.clearAllMocks();
    dataExtractor = new DataExtractor();
    
    mockPage = {
      url: vi.fn().mockReturnValue('https://example.com/page'),
      waitForSelector: vi.fn().mockResolvedValue(true),
      evaluate: vi.fn(),
      screenshot: vi.fn().mockResolvedValue(Buffer.from('screenshot'))
    };
  });

  describe('constructor', () => {
    it('should initialize data extractor', () => {
      expect(dataExtractor).toBeDefined();
    });
  });

  describe('attachToPage', () => {
    it('should attach to page', async () => {
      await dataExtractor.attachToPage(mockPage as Page);
      expect(dataExtractor).toBeDefined();
    });
  });

  describe('extractData', () => {
    it('should throw error when no page attached', async () => {
      const selectors = { title: 'h1' };
      
      await expect(dataExtractor.extractData(selectors))
        .rejects.toThrow('No page attached');
    });

    it('should extract data using CSS selectors', async () => {
      await dataExtractor.attachToPage(mockPage as Page);
      
      const selectors = {
        title: 'h1',
        content: '.content',
        price: '.price'
      };

      mockPage.evaluate.mockResolvedValue('Test Title');

      const result = await dataExtractor.extractData(selectors);

      expect(result).toBeDefined();
      expect(result.url).toBe('https://example.com/page');
      expect(result.domain).toBe('example.com');
      expect(result.raw).toBeDefined();
      expect(result.processed).toBeDefined();
    });

    it('should handle empty selectors', async () => {
      await dataExtractor.attachToPage(mockPage as Page);
      
      const result = await dataExtractor.extractData({});

      expect(result.raw).toEqual({});
      expect(result.processed).toEqual({});
    });

    it('should handle extraction errors', async () => {
      await dataExtractor.attachToPage(mockPage as Page);
      
      const selectors = { invalid: '>>invalid<<' };
      
      mockPage.waitForSelector.mockRejectedValue(new Error('Invalid selector'));

      const result = await dataExtractor.extractData(selectors);

      expect(result.raw.invalid).toBe('');
      expect(result.processed.invalid).toBeNull();
    });
  });

  describe('extractWithCustomLogic', () => {
    it('should throw error when no page attached', async () => {
      await expect(dataExtractor.extractWithCustomLogic('() => {}'))
        .rejects.toThrow('No page attached');
    });

    it('should execute custom extractor function', async () => {
      await dataExtractor.attachToPage(mockPage as Page);
      
      const extractorFunction = '(context) => context.test || "default"';
      const context = { test: 'custom result' };
      
      mockPage.evaluate.mockResolvedValue('custom result');

      const result = await dataExtractor.extractWithCustomLogic(extractorFunction, context);

      expect(result).toBe('custom result');
      expect(mockPage.evaluate).toHaveBeenCalled();
    });

    it('should handle custom extractor errors', async () => {
      await dataExtractor.attachToPage(mockPage as Page);
      
      mockPage.evaluate.mockRejectedValue(new Error('Execution failed'));

      const result = await dataExtractor.extractWithCustomLogic('invalid function');

      expect(result).toBeNull();
    });
  });

  describe('extractAllText', () => {
    it('should throw error when no page attached', async () => {
      await expect(dataExtractor.extractAllText())
        .rejects.toThrow('No page attached');
    });

    it('should extract all text from page', async () => {
      await dataExtractor.attachToPage(mockPage as Page);
      
      mockPage.evaluate.mockResolvedValue('All page text content');

      const result = await dataExtractor.extractAllText();

      expect(result).toBe('All page text content');
      expect(mockPage.evaluate).toHaveBeenCalled();
    });
  });

  describe('extractMetadata', () => {
    it('should throw error when no page attached', async () => {
      await expect(dataExtractor.extractMetadata())
        .rejects.toThrow('No page attached');
    });

    it('should extract page metadata', async () => {
      await dataExtractor.attachToPage(mockPage as Page);
      
      const mockMetadata = {
        title: 'Test Page',
        description: 'Test description',
        'og:title': 'Open Graph Title'
      };
      
      mockPage.evaluate.mockResolvedValue(mockMetadata);

      const result = await dataExtractor.extractMetadata();

      expect(result).toEqual(mockMetadata);
      expect(mockPage.evaluate).toHaveBeenCalled();
    });
  });

  describe('takeScreenshot', () => {
    it('should throw error when no page attached', async () => {
      await expect(dataExtractor.takeScreenshot())
        .rejects.toThrow('No page attached');
    });

    it('should take screenshot of page', async () => {
      await dataExtractor.attachToPage(mockPage as Page);
      
      const result = await dataExtractor.takeScreenshot();

      expect(result).toBeInstanceOf(Buffer);
      expect(mockPage.screenshot).toHaveBeenCalledWith({
        fullPage: false,
        type: 'png'
      });
    });
  });

  describe('private methods testing through public methods', () => {
    beforeEach(async () => {
      await dataExtractor.attachToPage(mockPage as Page);
    });

    it('should process amount values correctly', async () => {
      const selectors = { price: '.price' };
      mockPage.evaluate.mockResolvedValue('$99.99');

      const result = await dataExtractor.extractData(selectors);
      
      expect(result.processed.price).toBe(99.99);
    });

    it('should process number values with multipliers', async () => {
      const selectors = { followers: '.followers' };
      mockPage.evaluate.mockResolvedValue('1.5k');

      const result = await dataExtractor.extractData(selectors);
      
      expect(result.processed.followers).toBe(1500);
    });

    it('should process date values', async () => {
      const selectors = { date: '.date' };
      mockPage.evaluate.mockResolvedValue('2023-12-25');

      const result = await dataExtractor.extractData(selectors);
      
      expect(result.processed.date).toBeInstanceOf(Date);
    });

    it('should return original value for non-special keys', async () => {
      const selectors = { title: '.title' };
      mockPage.evaluate.mockResolvedValue('Simple Title');

      const result = await dataExtractor.extractData(selectors);
      
      expect(result.processed.title).toBe('Simple Title');
    });

    it('should handle input element values', async () => {
      const selectors = { input: 'input[name="test"]' };
      
      mockPage.evaluate.mockImplementation((fn, selector) => {
        // Mock the behavior of the evaluate function for input elements
        if (selector === 'input[name="test"]') {
          return 'input value';
        }
        return '';
      });

      const result = await dataExtractor.extractData(selectors);
      
      expect(result.raw.input).toBe('input value');
    });

    it('should handle selector timeout', async () => {
      const selectors = { missing: '.missing' };
      
      mockPage.waitForSelector.mockRejectedValue(new Error('Timeout'));
      
      const result = await dataExtractor.extractData(selectors);
      
      expect(result.raw.missing).toBe('');
      expect(result.processed.missing).toBeNull();
    });
  });
});