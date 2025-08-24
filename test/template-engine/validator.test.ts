import { describe, it, expect, beforeEach } from 'vitest';
import { TemplateValidator } from '../../src/template-engine/validator';

describe('TemplateValidator', () => {
  let validator: TemplateValidator;
  let mockTemplate: any;

  beforeEach(() => {
    validator = new TemplateValidator();
    mockTemplate = {
      domain: 'test.com',
      name: 'Test Template',
      version: '1.0.0',
      selectors: {
        balance: '.balance-amount',
        username: '#username',
        email: '[data-email]'
      },
      extractors: {
        hasMinBalance: '(params) => parseInt(balance) >= params.min',
        isVerified: '() => username.includes("verified")'
      },
      validation: {
        requiredFields: ['balance', 'username'],
        allowedDomains: ['test.com', 'www.test.com'],
        maxDataSize: 10000
      }
    };
  });

  describe('validateTemplate', () => {
    it('should validate correct template', () => {
      const result = validator.validateTemplate(mockTemplate);
      
      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it('should detect missing required fields', () => {
      delete mockTemplate.domain;
      delete mockTemplate.name;

      const result = validator.validateTemplate(mockTemplate);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Missing required field: domain');
      expect(result.errors).toContain('Missing required field: name');
    });

    it('should validate field types', () => {
      mockTemplate.selectors = 'not an object';
      mockTemplate.extractors = ['not', 'an', 'object'];

      const result = validator.validateTemplate(mockTemplate);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('selectors must be an object');
      expect(result.errors).toContain('extractors must be an object');
    });

    it('should validate selector syntax', () => {
      mockTemplate.selectors = {
        valid: '.valid-selector',
        invalid: 'no-selector-syntax',
        empty: ''
      };

      const result = validator.validateTemplate(mockTemplate);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Invalid selector "invalid": no-selector-syntax');
      expect(result.errors).toContain('Invalid selector "empty": ');
    });

    it('should validate extractor functions', () => {
      mockTemplate.extractors = {
        valid: '() => true',
        invalid: 'this is not a function {',
        malformed: '(params => params.value'
      };

      const result = validator.validateTemplate(mockTemplate);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Invalid extractor "invalid": Syntax error');
      expect(result.errors).toContain('Invalid extractor "malformed": Syntax error');
    });

    it('should validate domain format', () => {
      mockTemplate.domain = 'not a valid domain!';

      const result = validator.validateTemplate(mockTemplate);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Invalid domain format: not a valid domain!');
    });

    it('should validate version format', () => {
      mockTemplate.version = 'invalid-version';

      const result = validator.validateTemplate(mockTemplate);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Invalid version format: invalid-version');
    });
  });

  describe('validateData', () => {
    it('should validate data against template', () => {
      const data = {
        balance: '1000',
        username: 'john_verified',
        email: 'john@test.com'
      };

      const result = validator.validateData(data, mockTemplate);

      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it('should detect missing required fields', () => {
      const data = {
        email: 'john@test.com'
      };

      const result = validator.validateData(data, mockTemplate);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Missing required field: balance');
      expect(result.errors).toContain('Missing required field: username');
    });

    it('should validate data size', () => {
      const largeData = {
        balance: '1000',
        username: 'john',
        largeField: 'x'.repeat(20000)
      };

      const result = validator.validateData(largeData, mockTemplate);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Data size exceeds maximum: 20052 > 10000');
    });

    it('should allow any data when no validation rules', () => {
      delete mockTemplate.validation;
      
      const data = {
        anyField: 'anyValue'
      };

      const result = validator.validateData(data, mockTemplate);

      expect(result.valid).toBe(true);
    });

    it('should validate field types', () => {
      mockTemplate.validation.fieldTypes = {
        balance: 'number',
        username: 'string',
        email: 'email'
      };

      const invalidData = {
        balance: 'not-a-number',
        username: 123,
        email: 'not-an-email'
      };

      const result = validator.validateData(invalidData, mockTemplate);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Field "balance" must be of type number');
      expect(result.errors).toContain('Field "username" must be of type string');
      expect(result.errors).toContain('Field "email" must be a valid email');
    });
  });

  describe('validateSelector', () => {
    it('should validate CSS selectors', () => {
      expect(validator.validateSelector('.class')).toBe(true);
      expect(validator.validateSelector('#id')).toBe(true);
      expect(validator.validateSelector('[attr]')).toBe(true);
      expect(validator.validateSelector('div > span')).toBe(true);
      expect(validator.validateSelector('.class:hover')).toBe(true);
    });

    it('should reject invalid selectors', () => {
      expect(validator.validateSelector('')).toBe(false);
      expect(validator.validateSelector('no-selector')).toBe(false);
      expect(validator.validateSelector('123')).toBe(false);
      expect(validator.validateSelector('@')).toBe(false);
    });

    it('should validate XPath selectors', () => {
      expect(validator.validateSelector('//div')).toBe(true);
      expect(validator.validateSelector('/html/body/div')).toBe(true);
      expect(validator.validateSelector('//div[@class="test"]')).toBe(true);
    });
  });

  describe('validateExtractor', () => {
    it('should validate function syntax', () => {
      expect(validator.validateExtractor('() => true')).toBe(true);
      expect(validator.validateExtractor('(params) => params.value')).toBe(true);
      expect(validator.validateExtractor('function() { return true; }')).toBe(true);
    });

    it('should reject invalid syntax', () => {
      expect(validator.validateExtractor('not a function')).toBe(false);
      expect(validator.validateExtractor('() => {')).toBe(false);
      expect(validator.validateExtractor('(params => )')).toBe(false);
    });

    it('should detect dangerous code', () => {
      expect(validator.validateExtractor('() => eval("dangerous")')).toBe(false);
      expect(validator.validateExtractor('() => require("fs")')).toBe(false);
      expect(validator.validateExtractor('() => process.exit()')).toBe(false);
    });
  });

  describe('validateDomain', () => {
    it('should validate domain format', () => {
      expect(validator.validateDomain('example.com')).toBe(true);
      expect(validator.validateDomain('www.example.com')).toBe(true);
      expect(validator.validateDomain('sub.domain.example.com')).toBe(true);
      expect(validator.validateDomain('example.co.uk')).toBe(true);
    });

    it('should reject invalid domains', () => {
      expect(validator.validateDomain('not a domain!')).toBe(false);
      expect(validator.validateDomain('http://example.com')).toBe(false);
      expect(validator.validateDomain('example')).toBe(false);
      expect(validator.validateDomain('.com')).toBe(false);
      expect(validator.validateDomain('')).toBe(false);
    });
  });

  describe('validateVersion', () => {
    it('should validate semantic version', () => {
      expect(validator.validateVersion('1.0.0')).toBe(true);
      expect(validator.validateVersion('2.1.3')).toBe(true);
      expect(validator.validateVersion('0.0.1')).toBe(true);
      expect(validator.validateVersion('10.20.30')).toBe(true);
    });

    it('should reject invalid versions', () => {
      expect(validator.validateVersion('1.0')).toBe(false);
      expect(validator.validateVersion('v1.0.0')).toBe(false);
      expect(validator.validateVersion('1.0.0-beta')).toBe(false);
      expect(validator.validateVersion('not-a-version')).toBe(false);
    });
  });

  describe('sanitizeData', () => {
    it('should sanitize HTML in data', () => {
      const data = {
        safe: 'normal text',
        unsafe: '<script>alert("xss")</script>',
        html: '<b>bold</b> text'
      };

      const sanitized = validator.sanitizeData(data);

      expect(sanitized.safe).toBe('normal text');
      expect(sanitized.unsafe).not.toContain('<script>');
      expect(sanitized.html).not.toContain('<b>');
    });

    it('should preserve data types', () => {
      const data = {
        string: 'text',
        number: 123,
        boolean: true,
        null: null,
        array: [1, 2, 3],
        object: { nested: 'value' }
      };

      const sanitized = validator.sanitizeData(data);

      expect(typeof sanitized.string).toBe('string');
      expect(typeof sanitized.number).toBe('number');
      expect(typeof sanitized.boolean).toBe('boolean');
      expect(sanitized.null).toBe(null);
      expect(Array.isArray(sanitized.array)).toBe(true);
      expect(typeof sanitized.object).toBe('object');
    });

    it('should sanitize nested objects', () => {
      const data = {
        nested: {
          unsafe: '<script>alert("xss")</script>',
          deeper: {
            html: '<div onclick="alert()">click</div>'
          }
        }
      };

      const sanitized = validator.sanitizeData(data);

      expect(sanitized.nested.unsafe).not.toContain('<script>');
      expect(sanitized.nested.deeper.html).not.toContain('onclick');
    });
  });

  describe('compareTemplates', () => {
    it('should detect no changes', () => {
      const template2 = JSON.parse(JSON.stringify(mockTemplate));
      const diff = validator.compareTemplates(mockTemplate, template2);

      expect(diff.hasChanges).toBe(false);
      expect(diff.changes).toEqual([]);
    });

    it('should detect selector changes', () => {
      const template2 = {
        ...mockTemplate,
        selectors: {
          ...mockTemplate.selectors,
          balance: '.new-balance-selector',
          newField: '.new-field'
        }
      };

      const diff = validator.compareTemplates(mockTemplate, template2);

      expect(diff.hasChanges).toBe(true);
      expect(diff.changes).toContain('Selector changed: balance');
      expect(diff.changes).toContain('Selector added: newField');
    });

    it('should detect extractor changes', () => {
      const template2 = {
        ...mockTemplate,
        extractors: {
          hasMinBalance: '(params) => parseInt(balance) > params.min',
          newExtractor: '() => true'
        }
      };

      const diff = validator.compareTemplates(mockTemplate, template2);

      expect(diff.hasChanges).toBe(true);
      expect(diff.changes).toContain('Extractor changed: hasMinBalance');
      expect(diff.changes).toContain('Extractor added: newExtractor');
      expect(diff.changes).toContain('Extractor removed: isVerified');
    });

    it('should detect version changes', () => {
      const template2 = {
        ...mockTemplate,
        version: '2.0.0'
      };

      const diff = validator.compareTemplates(mockTemplate, template2);

      expect(diff.hasChanges).toBe(true);
      expect(diff.changes).toContain('Version changed: 1.0.0 -> 2.0.0');
    });
  });

  describe('generateValidationReport', () => {
    it('should generate comprehensive report', () => {
      const data = {
        balance: '1000',
        username: 'john_verified',
        email: 'john@test.com',
        extra: 'not-in-template'
      };

      const report = validator.generateValidationReport(data, mockTemplate);

      expect(report).toEqual({
        valid: true,
        errors: [],
        warnings: ['Extra field not in template: extra'],
        summary: {
          totalFields: 4,
          validFields: 4,
          missingRequired: 0,
          extraFields: 1
        }
      });
    });

    it('should include errors in report', () => {
      const data = {
        email: 'john@test.com'
      };

      const report = validator.generateValidationReport(data, mockTemplate);

      expect(report.valid).toBe(false);
      expect(report.errors).toContain('Missing required field: balance');
      expect(report.errors).toContain('Missing required field: username');
      expect(report.summary.missingRequired).toBe(2);
    });
  });
});