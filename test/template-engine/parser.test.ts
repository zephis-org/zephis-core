import { describe, it, expect, beforeEach } from 'vitest';
import { TemplateParser } from '../../src/template-engine/parser';

describe('TemplateParser', () => {
  let parser: TemplateParser;

  beforeEach(() => {
    parser = new TemplateParser();
  });

  describe('parse', () => {
    it('should parse valid template', () => {
      const templateData = {
        domain: 'test.com',
        name: 'Test Template',
        selectors: { field1: '.selector1' },
        extractors: { extractor1: '() => true' }
      };

      const template = parser.parse(templateData);

      expect(template).toEqual({
        domain: 'test.com',
        name: 'Test Template',
        version: '1.0.0',
        selectors: { field1: '.selector1' },
        extractors: { extractor1: '() => true' },
        validation: {}
      });
    });

    it('should include version if provided', () => {
      const templateData = {
        domain: 'test.com',
        name: 'Test',
        version: '2.0.0',
        selectors: { field1: '.selector1' },
        extractors: { extractor1: '() => true' }
      };

      const template = parser.parse(templateData);
      expect(template.version).toBe('2.0.0');
    });

    it('should throw error for missing domain', () => {
      const templateData = {
        name: 'Test',
        selectors: {},
        extractors: {}
      };

      expect(() => parser.parse(templateData))
        .toThrow('Template must have a domain');
    });

    it('should throw error for missing name', () => {
      const templateData = {
        domain: 'test.com',
        selectors: {},
        extractors: {}
      };

      expect(() => parser.parse(templateData))
        .toThrow('Template must have a name');
    });

    it('should throw error for invalid selectors', () => {
      const templateData = {
        domain: 'test.com',
        name: 'Test',
        selectors: 'invalid',
        extractors: {}
      };

      expect(() => parser.parse(templateData))
        .toThrow('Template must have selectors object');
    });

    it('should throw error for non-string selector', () => {
      const templateData = {
        domain: 'test.com',
        name: 'Test',
        selectors: { field1: 123 },
        extractors: {}
      };

      expect(() => parser.parse(templateData))
        .toThrow('Selector field1 must be a string');
    });

    it('should throw error for non-string extractor', () => {
      const templateData = {
        domain: 'test.com',
        name: 'Test',
        selectors: {},
        extractors: { extractor1: true }
      };

      expect(() => parser.parse(templateData))
        .toThrow('Extractor extractor1 must be a string');
    });
  });

  describe('merge', () => {
    it('should merge templates', () => {
      const base = {
        domain: 'test.com',
        name: 'Base',
        version: '1.0.0',
        selectors: { field1: '.selector1' },
        extractors: { extractor1: '() => true' }
      };

      const override = {
        name: 'Override',
        selectors: { field2: '.selector2' },
        extractors: { extractor2: '() => false' }
      };

      const merged = parser.merge(base, override);

      expect(merged).toEqual({
        domain: 'test.com',
        name: 'Override',
        version: '1.0.0',
        selectors: {
          field1: '.selector1',
          field2: '.selector2'
        },
        extractors: {
          extractor1: '() => true',
          extractor2: '() => false'
        },
        validation: {}
      });
    });

    it('should merge validation rules', () => {
      const base = {
        domain: 'test.com',
        name: 'Base',
        version: '1.0.0',
        selectors: {},
        extractors: {},
        validation: { requiredFields: ['field1'] }
      };

      const override = {
        validation: { maxDataSize: 1000 }
      };

      const merged = parser.merge(base, override);

      expect(merged.validation).toEqual({
        requiredFields: ['field1'],
        maxDataSize: 1000
      });
    });
  });

  describe('validateDomain', () => {
    const template = {
      domain: 'example.com',
      name: 'Test',
      version: '1.0.0',
      selectors: {},
      extractors: {}
    };

    it('should validate matching domain', () => {
      expect(parser.validateDomain(template, 'example.com')).toBe(true);
    });

    it('should validate with www prefix', () => {
      expect(parser.validateDomain(template, 'www.example.com')).toBe(true);
    });

    it('should validate subdomain', () => {
      expect(parser.validateDomain(template, 'sub.example.com')).toBe(true);
    });

    it('should use allowedDomains if specified', () => {
      const templateWithAllowed = {
        ...template,
        validation: {
          allowedDomains: ['specific.com', 'another.com']
        }
      };

      expect(parser.validateDomain(templateWithAllowed, 'specific.com')).toBe(true);
      expect(parser.validateDomain(templateWithAllowed, 'another.com')).toBe(true);
      expect(parser.validateDomain(templateWithAllowed, 'example.com')).toBe(false);
    });
  });

  describe('getRequiredFields', () => {
    it('should return required fields from validation', () => {
      const template = {
        domain: 'test.com',
        name: 'Test',
        version: '1.0.0',
        selectors: { field1: '.s1', field2: '.s2' },
        extractors: {},
        validation: { requiredFields: ['field1'] }
      };

      expect(parser.getRequiredFields(template)).toEqual(['field1']);
    });

    it('should return all selector keys if no required fields specified', () => {
      const template = {
        domain: 'test.com',
        name: 'Test',
        version: '1.0.0',
        selectors: { field1: '.s1', field2: '.s2' },
        extractors: {}
      };

      expect(parser.getRequiredFields(template)).toEqual(['field1', 'field2']);
    });
  });

  describe('generateSelectorMap', () => {
    it('should generate selector map', () => {
      const template = {
        domain: 'test.com',
        name: 'Test',
        version: '1.0.0',
        selectors: {
          field1: '.selector1',
          field2: '.selector2'
        },
        extractors: {}
      };

      const map = parser.generateSelectorMap(template);

      expect(map.get('field1')).toBe('.selector1');
      expect(map.get('field2')).toBe('.selector2');
      expect(map.size).toBe(2);
    });
  });

  describe('generateExtractorFunction', () => {
    it('should generate valid extractor function', () => {
      const template = {
        domain: 'test.com',
        name: 'Test',
        version: '1.0.0',
        selectors: { balance: '.balance' },
        extractors: {
          checkBalance: '(params) => parseInt(balance) > params.min'
        }
      };

      const func = parser.generateExtractorFunction(template, 'checkBalance');

      expect(func).toBeInstanceOf(Function);
      
      const result = func({ balance: '100' }, { min: 50 });
      expect(result).toBe(true);
    });

    it('should return null for non-existent extractor', () => {
      const template = {
        domain: 'test.com',
        name: 'Test',
        version: '1.0.0',
        selectors: {},
        extractors: {}
      };

      const func = parser.generateExtractorFunction(template, 'missing');
      expect(func).toBeNull();
    });

    it('should return null for invalid extractor code', () => {
      const template = {
        domain: 'test.com',
        name: 'Test',
        version: '1.0.0',
        selectors: {},
        extractors: {
          invalid: 'this is not valid javascript {'
        }
      };

      const func = parser.generateExtractorFunction(template, 'invalid');
      expect(func).toBeNull();
    });
  });

  describe('serialize/deserialize', () => {
    it('should serialize template to JSON', () => {
      const template = {
        domain: 'test.com',
        name: 'Test',
        version: '1.0.0',
        selectors: { field1: '.selector1' },
        extractors: { extractor1: '() => true' }
      };

      const json = parser.serialize(template);
      expect(json).toContain('"domain": "test.com"');
      expect(json).toContain('"name": "Test"');
    });

    it('should deserialize JSON to template', () => {
      const json = JSON.stringify({
        domain: 'test.com',
        name: 'Test',
        selectors: { field1: '.selector1' },
        extractors: { extractor1: '() => true' }
      });

      const template = parser.deserialize(json);

      expect(template).toEqual({
        domain: 'test.com',
        name: 'Test',
        version: '1.0.0',
        selectors: { field1: '.selector1' },
        extractors: { extractor1: '() => true' },
        validation: {}
      });
    });

    it('should throw error for invalid JSON', () => {
      expect(() => parser.deserialize('not valid json'))
        .toThrow('Failed to deserialize template');
    });
  });
});