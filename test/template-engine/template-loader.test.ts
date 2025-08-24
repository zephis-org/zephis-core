import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock dependencies before importing
vi.mock('fs/promises', () => ({
  default: {
    readFile: vi.fn(),
    writeFile: vi.fn(),
    readdir: vi.fn(),
    unlink: vi.fn()
  }
}));

vi.mock('path', () => ({
  default: {
    join: vi.fn((...args) => args.join('/')),
    resolve: vi.fn((...args) => args.join('/'))
  }
}));

vi.mock('../../src/template-engine/parser', () => ({
  TemplateParser: vi.fn().mockImplementation(() => ({
    parse: vi.fn().mockImplementation(json => json),
    serialize: vi.fn().mockImplementation(template => JSON.stringify(template, null, 2)),
    validateDomain: vi.fn().mockReturnValue(true)
  }))
}));

vi.mock('../../src/template-engine/validator', () => ({
  TemplateValidator: vi.fn().mockImplementation(() => ({
    validateTemplate: vi.fn().mockReturnValue({ valid: true, errors: [] })
  }))
}));

vi.mock('../../src/utils/logger', () => ({
  default: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn()
  }
}));

import { TemplateLoader } from '../../src/template-engine/template-loader';
import { Template } from '../../src/types';

describe('TemplateLoader', () => {
  let templateLoader: TemplateLoader;
  let mockTemplate: Template;

  beforeEach(async () => {
    vi.clearAllMocks();
    
    mockTemplate = {
      id: 'test-template',
      name: 'Test Template',
      version: '1.0.0',
      domain: 'example.com',
      selectors: {
        title: 'h1',
        content: '.content',
        price: '.price'
      },
      extractors: {
        title: '(el) => el.textContent?.trim()',
        price: '(el) => parseFloat(el.textContent?.replace(/[^0-9.]/g, "") || "0")'
      },
      metadata: {
        author: 'Test Author',
        description: 'Test template description',
        tags: ['test', 'example'],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
    };

    templateLoader = new TemplateLoader();
  });

  describe('constructor', () => {
    it('should initialize with default templates directory', () => {
      expect(templateLoader).toBeDefined();
    });

    it('should accept custom templates directory', () => {
      const customLoader = new TemplateLoader('/custom/templates');
      expect(customLoader).toBeDefined();
    });
  });

  describe('getTemplate', () => {
    it('should return undefined for non-existent template', () => {
      const template = templateLoader.getTemplate('nonexistent');
      expect(template).toBeUndefined();
    });
  });

  describe('listTemplates', () => {
    it('should return empty list initially', () => {
      const templates = templateLoader.listTemplates();
      expect(templates).toEqual([]);
    });
  });

  describe('clearCache', () => {
    it('should clear template cache', () => {
      templateLoader.clearCache();
      expect(templateLoader.listTemplates()).toEqual([]);
    });
  });

  describe('getTemplateForDomain', () => {
    it('should return undefined for non-matching domain', () => {
      const template = templateLoader.getTemplateForDomain('nonexistent.com');
      expect(template).toBeUndefined();
    });
  });

  describe('loadFromUrl', () => {
    it('should throw error for URL loading (not implemented)', async () => {
      await expect(templateLoader.loadFromUrl('https://example.com/template.json'))
        .rejects.toThrow('URL loading not implemented yet');
    });
  });
});