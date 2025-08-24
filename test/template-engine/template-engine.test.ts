import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock dependencies before importing
vi.mock('../../src/template-engine/parser', () => ({
  TemplateParser: vi.fn().mockImplementation(() => ({
    parse: vi.fn().mockImplementation(data => data),
    serialize: vi.fn().mockImplementation(template => JSON.stringify(template)),
    deserialize: vi.fn().mockImplementation(str => JSON.parse(str)),
    validateDomain: vi.fn().mockReturnValue(true),
    generateExtractorFunction: vi.fn().mockReturnValue(() => 'extracted')
  }))
}));

vi.mock('../../src/template-engine/template-loader', () => ({
  TemplateLoader: vi.fn().mockImplementation(() => ({
    loadFromFile: vi.fn().mockResolvedValue({ name: 'Test Template', domain: 'example.com' }),
    loadFromUrl: vi.fn().mockRejectedValue(new Error('URL loading not implemented'))
  }))
}));

vi.mock('../../src/template-engine/validator', () => ({
  TemplateValidator: vi.fn().mockImplementation(() => ({
    validateTemplate: vi.fn().mockReturnValue({ valid: true, errors: [] }),
    validateData: vi.fn().mockReturnValue({ valid: true, errors: [] }),
    sanitizeData: vi.fn().mockImplementation(data => data)
  }))
}));

vi.mock('../../src/template-engine/extractor-engine', () => ({
  ExtractorEngine: vi.fn().mockImplementation(() => ({
    extract: vi.fn().mockResolvedValue({ title: 'Test Title', content: 'Test Content' })
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

import { TemplateEngine } from '../../src/template-engine/template-engine';
import { Template } from '../../src/types';

describe('TemplateEngine', () => {
  let templateEngine: TemplateEngine;
  let mockTemplate: Template;

  beforeEach(() => {
    vi.clearAllMocks();
    templateEngine = new TemplateEngine();

    mockTemplate = {
      id: 'test-template',
      name: 'Test Template',
      version: '1.0.0',
      domain: 'example.com',
      selectors: {
        title: 'h1',
        content: '.content'
      },
      extractors: {
        title: '(data) => data.title.toUpperCase()'
      },
      metadata: {
        author: 'Test Author',
        description: 'Test description',
        tags: ['test'],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
    };
  });

  describe('constructor', () => {
    it('should initialize template engine', () => {
      expect(templateEngine).toBeDefined();
    });
  });

  describe('getTemplate', () => {
    it('should return null for non-existent template', () => {
      const template = templateEngine.getTemplate('nonexistent');
      expect(template).toBeNull();
    });
  });

  describe('listTemplates', () => {
    it('should return empty array when no templates loaded', () => {
      const templates = templateEngine.listTemplates();
      expect(templates).toEqual([]);
    });
  });

  describe('validateDomain', () => {
    it('should return false for non-existent template', () => {
      const isValid = templateEngine.validateDomain('nonexistent', 'example.com');
      expect(isValid).toBe(false);
    });
  });

  describe('clearTemplates', () => {
    it('should clear all loaded templates', () => {
      templateEngine.clearTemplates();
      expect(templateEngine.listTemplates()).toHaveLength(0);
    });
  });

  describe('removeTemplate', () => {
    it('should return false for non-existent template', () => {
      const removed = templateEngine.removeTemplate('nonexistent');
      expect(removed).toBe(false);
    });
  });

  describe('extractData', () => {
    it('should throw error for non-existent template', async () => {
      await expect(templateEngine.extractData('nonexistent', '<html></html>'))
        .rejects.toThrow('Template nonexistent not found');
    });
  });

  describe('validateData', () => {
    it('should throw error for non-existent template', () => {
      const data = { title: 'Test' };
      expect(() => templateEngine.validateData(data, 'nonexistent'))
        .toThrow('Template nonexistent not found');
    });
  });

  describe('exportTemplate', () => {
    it('should throw error for non-existent template', () => {
      expect(() => templateEngine.exportTemplate('nonexistent'))
        .toThrow('Template nonexistent not found');
    });
  });
});