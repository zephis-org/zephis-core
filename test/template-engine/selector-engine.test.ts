import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SelectorEngine } from '../../src/template-engine/selector-engine';
import { Page } from 'puppeteer';

vi.mock('../../src/utils/logger', () => ({
  default: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn()
  }
}));

describe('SelectorEngine', () => {
  let selectorEngine: SelectorEngine;
  let mockPage: any;

  beforeEach(() => {
    vi.clearAllMocks();
    selectorEngine = new SelectorEngine();
    
    mockPage = {
      evaluate: vi.fn(),
      $: vi.fn(),
      waitForSelector: vi.fn()
    };
  });

  describe('constructor', () => {
    it('should initialize selector engine', () => {
      expect(selectorEngine).toBeDefined();
    });
  });

  describe('attachToPage', () => {
    it('should attach to page and clear cache', async () => {
      await selectorEngine.attachToPage(mockPage as Page);
      expect(selectorEngine).toBeDefined();
    });
  });

  describe('selectSingle', () => {
    it('should throw error when no page attached', async () => {
      await expect(selectorEngine.selectSingle('h1'))
        .rejects.toThrow('No page attached');
    });

    it('should select single element text content', async () => {
      await selectorEngine.attachToPage(mockPage as Page);
      mockPage.evaluate.mockResolvedValue('Test Title');

      const result = await selectorEngine.selectSingle('h1');

      expect(result).toBe('Test Title');
      expect(mockPage.evaluate).toHaveBeenCalled();
    });

    it('should return cached result on second call', async () => {
      await selectorEngine.attachToPage(mockPage as Page);
      mockPage.evaluate.mockResolvedValue('Cached Result');

      const result1 = await selectorEngine.selectSingle('h1');
      const result2 = await selectorEngine.selectSingle('h1');

      expect(result1).toBe('Cached Result');
      expect(result2).toBe('Cached Result');
      expect(mockPage.evaluate).toHaveBeenCalledTimes(1);
    });

    it('should return null for non-existent element', async () => {
      await selectorEngine.attachToPage(mockPage as Page);
      mockPage.evaluate.mockResolvedValue(null);

      const result = await selectorEngine.selectSingle('.nonexistent');

      expect(result).toBeNull();
    });

    it('should handle evaluation errors', async () => {
      await selectorEngine.attachToPage(mockPage as Page);
      mockPage.evaluate.mockRejectedValue(new Error('Evaluation failed'));

      const result = await selectorEngine.selectSingle('invalid');

      expect(result).toBeNull();
    });
  });

  describe('selectMultiple', () => {
    it('should throw error when no page attached', async () => {
      await expect(selectorEngine.selectMultiple('.item'))
        .rejects.toThrow('No page attached');
    });

    it('should select multiple elements', async () => {
      await selectorEngine.attachToPage(mockPage as Page);
      mockPage.evaluate.mockResolvedValue(['Item 1', 'Item 2', 'Item 3']);

      const result = await selectorEngine.selectMultiple('.item');

      expect(result).toEqual(['Item 1', 'Item 2', 'Item 3']);
    });

    it('should return cached result on second call', async () => {
      await selectorEngine.attachToPage(mockPage as Page);
      mockPage.evaluate.mockResolvedValue(['Cached 1', 'Cached 2']);

      const result1 = await selectorEngine.selectMultiple('.items');
      const result2 = await selectorEngine.selectMultiple('.items');

      expect(result1).toEqual(['Cached 1', 'Cached 2']);
      expect(result2).toEqual(['Cached 1', 'Cached 2']);
      expect(mockPage.evaluate).toHaveBeenCalledTimes(1);
    });

    it('should handle evaluation errors', async () => {
      await selectorEngine.attachToPage(mockPage as Page);
      mockPage.evaluate.mockRejectedValue(new Error('Evaluation failed'));

      const result = await selectorEngine.selectMultiple('invalid');

      expect(result).toEqual([]);
    });
  });

  describe('selectAttribute', () => {
    it('should throw error when no page attached', async () => {
      await expect(selectorEngine.selectAttribute('a', 'href'))
        .rejects.toThrow('No page attached');
    });

    it('should select element attribute', async () => {
      await selectorEngine.attachToPage(mockPage as Page);
      mockPage.evaluate.mockResolvedValue('https://example.com');

      const result = await selectorEngine.selectAttribute('a', 'href');

      expect(result).toBe('https://example.com');
      expect(mockPage.evaluate).toHaveBeenCalledWith(
        expect.any(Function),
        'a',
        'href'
      );
    });

    it('should return cached result on second call', async () => {
      await selectorEngine.attachToPage(mockPage as Page);
      mockPage.evaluate.mockResolvedValue('cached-value');

      const result1 = await selectorEngine.selectAttribute('img', 'src');
      const result2 = await selectorEngine.selectAttribute('img', 'src');

      expect(result1).toBe('cached-value');
      expect(result2).toBe('cached-value');
      expect(mockPage.evaluate).toHaveBeenCalledTimes(1);
    });

    it('should handle evaluation errors', async () => {
      await selectorEngine.attachToPage(mockPage as Page);
      mockPage.evaluate.mockRejectedValue(new Error('Evaluation failed'));

      const result = await selectorEngine.selectAttribute('invalid', 'attr');

      expect(result).toBeNull();
    });
  });

  describe('exists', () => {
    it('should throw error when no page attached', async () => {
      await expect(selectorEngine.exists('h1'))
        .rejects.toThrow('No page attached');
    });

    it('should return true if element exists', async () => {
      await selectorEngine.attachToPage(mockPage as Page);
      mockPage.$.mockResolvedValue({});

      const result = await selectorEngine.exists('h1');

      expect(result).toBe(true);
    });

    it('should return false if element does not exist', async () => {
      await selectorEngine.attachToPage(mockPage as Page);
      mockPage.$.mockResolvedValue(null);

      const result = await selectorEngine.exists('.nonexistent');

      expect(result).toBe(false);
    });

    it('should handle errors', async () => {
      await selectorEngine.attachToPage(mockPage as Page);
      mockPage.$.mockRejectedValue(new Error('Selector error'));

      const result = await selectorEngine.exists('invalid');

      expect(result).toBe(false);
    });
  });

  describe('waitForSelector', () => {
    it('should throw error when no page attached', async () => {
      await expect(selectorEngine.waitForSelector('h1'))
        .rejects.toThrow('No page attached');
    });

    it('should wait for selector and return true', async () => {
      await selectorEngine.attachToPage(mockPage as Page);
      mockPage.waitForSelector.mockResolvedValue({});

      const result = await selectorEngine.waitForSelector('h1');

      expect(result).toBe(true);
      expect(mockPage.waitForSelector).toHaveBeenCalledWith('h1', {
        timeout: 30000,
        visible: undefined
      });
    });

    it('should accept custom timeout and visibility options', async () => {
      await selectorEngine.attachToPage(mockPage as Page);
      mockPage.waitForSelector.mockResolvedValue({});

      const result = await selectorEngine.waitForSelector('h1', {
        timeout: 5000,
        visible: true
      });

      expect(result).toBe(true);
      expect(mockPage.waitForSelector).toHaveBeenCalledWith('h1', {
        timeout: 5000,
        visible: true
      });
    });

    it('should return false on timeout', async () => {
      await selectorEngine.attachToPage(mockPage as Page);
      mockPage.waitForSelector.mockRejectedValue(new Error('Timeout'));

      const result = await selectorEngine.waitForSelector('.loading');

      expect(result).toBe(false);
    });
  });

  describe('selectWithXPath', () => {
    it('should throw error when no page attached', async () => {
      await expect(selectorEngine.selectWithXPath('//h1'))
        .rejects.toThrow('No page attached');
    });

    it('should select element using XPath', async () => {
      await selectorEngine.attachToPage(mockPage as Page);
      mockPage.evaluate.mockResolvedValue('XPath Result');

      const result = await selectorEngine.selectWithXPath('//h1[1]');

      expect(result).toBe('XPath Result');
    });

    it('should handle XPath evaluation errors', async () => {
      await selectorEngine.attachToPage(mockPage as Page);
      mockPage.evaluate.mockRejectedValue(new Error('XPath failed'));

      const result = await selectorEngine.selectWithXPath('invalid-xpath');

      expect(result).toBeNull();
    });
  });

  describe('selectTable', () => {
    it('should throw error when no page attached', async () => {
      await expect(selectorEngine.selectTable('table'))
        .rejects.toThrow('No page attached');
    });

    it('should select table data', async () => {
      await selectorEngine.attachToPage(mockPage as Page);
      const tableData = [
        ['Header 1', 'Header 2'],
        ['Row 1 Col 1', 'Row 1 Col 2'],
        ['Row 2 Col 1', 'Row 2 Col 2']
      ];
      mockPage.evaluate.mockResolvedValue(tableData);

      const result = await selectorEngine.selectTable('table');

      expect(result).toEqual(tableData);
    });

    it('should return empty array for non-table element', async () => {
      await selectorEngine.attachToPage(mockPage as Page);
      mockPage.evaluate.mockResolvedValue([]);

      const result = await selectorEngine.selectTable('div');

      expect(result).toEqual([]);
    });

    it('should handle table selection errors', async () => {
      await selectorEngine.attachToPage(mockPage as Page);
      mockPage.evaluate.mockRejectedValue(new Error('Table selection failed'));

      const result = await selectorEngine.selectTable('table');

      expect(result).toEqual([]);
    });
  });

  describe('selectJSON', () => {
    it('should throw error when no page attached', async () => {
      await expect(selectorEngine.selectJSON('.json-data'))
        .rejects.toThrow('No page attached');
    });

    it('should parse JSON from element content', async () => {
      await selectorEngine.attachToPage(mockPage as Page);
      const jsonData = { test: 'value', number: 42 };
      
      // Mock selectSingle to return JSON string
      vi.spyOn(selectorEngine, 'selectSingle').mockResolvedValue(JSON.stringify(jsonData));

      const result = await selectorEngine.selectJSON('.json-data');

      expect(result).toEqual(jsonData);
    });

    it('should return null for invalid JSON', async () => {
      await selectorEngine.attachToPage(mockPage as Page);
      
      vi.spyOn(selectorEngine, 'selectSingle').mockResolvedValue('invalid json');

      const result = await selectorEngine.selectJSON('.invalid-json');

      expect(result).toBeNull();
    });

    it('should return null for empty content', async () => {
      await selectorEngine.attachToPage(mockPage as Page);
      
      vi.spyOn(selectorEngine, 'selectSingle').mockResolvedValue(null);

      const result = await selectorEngine.selectJSON('.empty');

      expect(result).toBeNull();
    });
  });

  describe('clearCache', () => {
    it('should clear the cache', async () => {
      await selectorEngine.attachToPage(mockPage as Page);
      mockPage.evaluate.mockResolvedValue('Cached Result');

      // First call to populate cache
      await selectorEngine.selectSingle('h1');
      expect(mockPage.evaluate).toHaveBeenCalledTimes(1);

      // Second call should use cache
      await selectorEngine.selectSingle('h1');
      expect(mockPage.evaluate).toHaveBeenCalledTimes(1);

      // Clear cache
      selectorEngine.clearCache();

      // Third call should not use cache
      await selectorEngine.selectSingle('h1');
      expect(mockPage.evaluate).toHaveBeenCalledTimes(2);
    });
  });
});