import { describe, it, expect, beforeEach } from 'vitest';
import { InputFormatter } from '../../src/proof/input-formatter';
import { ExtractedData, TLSSessionData } from '../../src/types';

describe('InputFormatter', () => {
  let inputFormatter: InputFormatter;
  let mockExtractedData: ExtractedData;
  let mockTLSData: TLSSessionData;

  beforeEach(() => {
    inputFormatter = new InputFormatter();
    
    mockExtractedData = {
      raw: {
        balance: '$1,234.56',
        followers: '10500',
        verified: 'true'
      },
      processed: {
        balance: 1234.56,
        followers: 10500,
        verified: true,
        createdAt: new Date('2020-01-01').getTime(),
        threshold: 1000
      },
      timestamp: Date.now(),
      url: 'https://test.com/profile',
      domain: 'test.com'
    };

    mockTLSData = {
      serverCertificate: 'mock-cert-data',
      sessionKeys: {
        clientRandom: '0x1234567890abcdef1234567890abcdef12345678',
        serverRandom: '0xfedcba0987654321fedcba0987654321fedcba09',
        masterSecret: '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd'
      },
      handshakeMessages: [
        '0x160301004e0100004a03031234567890abcdef',
        '0x160301004f0200004b03031234567890abcdef'
      ],
      timestamp: Date.now()
    };
  });

  describe('formatInput', () => {
    it('should format input with all basic data types', () => {
      const result = inputFormatter.formatInput(mockExtractedData, mockTLSData, 'balanceGreaterThan');

      expect(result).toHaveProperty('timestamp');
      expect(result).toHaveProperty('domain');
      expect(result).toHaveProperty('url');
      expect(result).toHaveProperty('clientRandom');
      expect(result).toHaveProperty('serverRandom');
      expect(result).toHaveProperty('masterSecret');
      expect(typeof result.timestamp).toBe('number');
    });

    it('should handle number values correctly', () => {
      mockExtractedData.processed.numericValue = 42;
      const result = inputFormatter.formatInput(mockExtractedData, mockTLSData, 'test');

      expect(result.numericValue).toBe('42');
    });

    it('should handle string values correctly', () => {
      mockExtractedData.processed.textValue = 'hello world';
      const result = inputFormatter.formatInput(mockExtractedData, mockTLSData, 'test');

      expect(Array.isArray(result.textValue)).toBe(true);
      expect(result.textValue.length).toBeGreaterThan(0);
      expect(result.textValue[0]).toMatch(/^\d+$/);
    });

    it('should handle boolean values correctly', () => {
      mockExtractedData.processed.trueValue = true;
      mockExtractedData.processed.falseValue = false;
      const result = inputFormatter.formatInput(mockExtractedData, mockTLSData, 'test');

      expect(result.trueValue).toBe('1');
      expect(result.falseValue).toBe('0');
    });

    it('should handle Date values correctly', () => {
      const testDate = new Date('2023-01-01T00:00:00Z');
      mockExtractedData.processed.dateValue = testDate;
      const result = inputFormatter.formatInput(mockExtractedData, mockTLSData, 'test');

      expect(result.dateValue).toBe(Math.floor(testDate.getTime() / 1000).toString());
    });

    it('should format claim-specific inputs for balanceGreaterThan', () => {
      const result = inputFormatter.formatInput(mockExtractedData, mockTLSData, 'balanceGreaterThan');

      expect(result).toHaveProperty('balance');
      expect(result).toHaveProperty('threshold');
      expect(result.balance).toBe('123456'); // 1234.56 * 100
      expect(result.threshold).toBe('1000');
    });

    it('should format claim-specific inputs for hasMinimumBalance', () => {
      const result = inputFormatter.formatInput(mockExtractedData, mockTLSData, 'hasMinimumBalance');

      expect(result).toHaveProperty('balance');
      expect(result).toHaveProperty('threshold');
    });

    it('should format claim-specific inputs for followersGreaterThan', () => {
      const result = inputFormatter.formatInput(mockExtractedData, mockTLSData, 'followersGreaterThan');

      expect(result).toHaveProperty('followers');
      expect(result).toHaveProperty('threshold');
      expect(result.followers).toBe('10500');
      expect(result.threshold).toBe('1000');
    });

    it('should format claim-specific inputs for isInfluencer', () => {
      const result = inputFormatter.formatInput(mockExtractedData, mockTLSData, 'isInfluencer');

      expect(result).toHaveProperty('followers');
      expect(result).toHaveProperty('threshold');
      expect(result.threshold).toBe('10000'); // default for influencer
    });

    it('should format claim-specific inputs for hasVerifiedBadge', () => {
      const result = inputFormatter.formatInput(mockExtractedData, mockTLSData, 'hasVerifiedBadge');

      expect(result).toHaveProperty('verified');
      expect(result.verified).toBe('1');
    });

    it('should format claim-specific inputs for accountAge', () => {
      const result = inputFormatter.formatInput(mockExtractedData, mockTLSData, 'accountAge');

      expect(result).toHaveProperty('createdAt');
      expect(result).toHaveProperty('currentTime');
    });

    it('should handle unknown claim types', () => {
      const result = inputFormatter.formatInput(mockExtractedData, mockTLSData, 'unknownClaim');

      expect(result).toHaveProperty('claimResult');
      expect(result.claimResult).toBe('1');
    });

    it('should throw error when formatting fails', () => {
      const invalidTLSData = { ...mockTLSData, sessionKeys: null } as any;

      expect(() => {
        inputFormatter.formatInput(mockExtractedData, invalidTLSData, 'test');
      }).toThrow();
    });
  });

  describe('stringToFieldElements', () => {
    it('should convert string to field elements', () => {
      const result = inputFormatter['stringToFieldElements']('hello world');

      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBeGreaterThan(0);
      expect(result[0]).toMatch(/^\d+$/);
    });

    it('should handle empty strings', () => {
      const result = inputFormatter['stringToFieldElements']('');

      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBe(0);
    });

    it('should handle long strings by chunking', () => {
      const longString = 'a'.repeat(100);
      const result = inputFormatter['stringToFieldElements'](longString);

      expect(result.length).toBeGreaterThan(1);
      result.forEach(element => {
        expect(element).toMatch(/^\d+$/);
      });
    });

    it('should handle unicode characters', () => {
      const unicodeString = 'Hello 世界 🌍';
      const result = inputFormatter['stringToFieldElements'](unicodeString);

      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBeGreaterThan(0);
    });
  });

  describe('hexToFieldElement', () => {
    it('should convert hex string to field element', () => {
      const hex = '0x1234567890abcdef';
      const result = inputFormatter['hexToFieldElement'](hex);

      expect(typeof result).toBe('string');
      expect(result).toMatch(/^\d+$/);
    });

    it('should handle hex without 0x prefix', () => {
      const hex = '1234567890abcdef';
      const result = inputFormatter['hexToFieldElement'](hex);

      expect(typeof result).toBe('string');
      expect(result).toMatch(/^\d+$/);
    });

    it('should handle empty hex string', () => {
      const result = inputFormatter['hexToFieldElement']('');

      expect(result).toBe('0');
    });

    it('should handle long hex strings by chunking', () => {
      const longHex = '0x' + '1234567890abcdef'.repeat(10);
      const result = inputFormatter['hexToFieldElement'](longHex);

      expect(typeof result).toBe('string');
      expect(result).toMatch(/^\d+$/);
    });

    it('should handle 0x prefix correctly', () => {
      const hex = '0x1234';
      const result = inputFormatter['hexToFieldElement'](hex);

      expect(result).toBe('4660'); // 0x1234 in decimal
    });
  });

  describe('parseAmount', () => {
    it('should parse numeric amounts', () => {
      expect(inputFormatter['parseAmount'](123.45)).toBe('12345');
      expect(inputFormatter['parseAmount'](0)).toBe('0');
      expect(inputFormatter['parseAmount'](1000)).toBe('100000');
    });

    it('should parse string amounts with currency symbols', () => {
      expect(inputFormatter['parseAmount']('$123.45')).toBe('12345');
      expect(inputFormatter['parseAmount']('€1,234.56')).toBe('123456');
      expect(inputFormatter['parseAmount']('¥10,000')).toBe('1000000');
    });

    it('should handle comma separators', () => {
      expect(inputFormatter['parseAmount']('1,234,567.89')).toBe('123456789');
    });

    it('should handle negative amounts', () => {
      expect(inputFormatter['parseAmount']('-123.45')).toBe('-12345');
    });

    it('should handle invalid strings', () => {
      expect(inputFormatter['parseAmount']('invalid')).toBe('0');
      expect(inputFormatter['parseAmount']('abc123def')).toBe('12300');
    });

    it('should handle null/undefined values', () => {
      expect(inputFormatter['parseAmount'](null)).toBe('0');
      expect(inputFormatter['parseAmount'](undefined)).toBe('0');
    });

    it('should handle floating point precision', () => {
      expect(inputFormatter['parseAmount'](0.1 + 0.2)).toBe('30'); // handles JS precision issues
    });
  });

  describe('hashData', () => {
    it('should hash data consistently', () => {
      const data = { test: 'value', number: 123 };
      const hash1 = inputFormatter.hashData(data);
      const hash2 = inputFormatter.hashData(data);

      expect(hash1).toBe(hash2);
      expect(hash1).toMatch(/^\d+$/);
    });

    it('should produce different hashes for different data', () => {
      const data1 = { test: 'value1' };
      const data2 = { test: 'value2' };

      const hash1 = inputFormatter.hashData(data1);
      const hash2 = inputFormatter.hashData(data2);

      expect(hash1).not.toBe(hash2);
    });

    it('should handle complex nested objects', () => {
      const data = {
        nested: {
          array: [1, 2, 3],
          object: { deep: 'value' }
        }
      };

      const hash = inputFormatter.hashData(data);
      expect(hash).toMatch(/^\d+$/);
    });

    it('should handle circular references safely', () => {
      const data: any = { test: 'value' };
      data.self = data;

      // Should not throw, JSON.stringify handles circular refs
      expect(() => inputFormatter.hashData(data)).not.toThrow();
    });
  });

  describe('formatTLSHandshake', () => {
    it('should format handshake messages', () => {
      const messages = [
        '0x160301004e0100004a03031234567890abcdef',
        '0xfedcba0987654321fedcba0987654321fedcba09'
      ];

      const result = inputFormatter.formatTLSHandshake(messages);

      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBe(2);
      result.forEach(element => {
        expect(element).toMatch(/^\d+$/);
      });
    });

    it('should handle messages without 0x prefix', () => {
      const messages = [
        '160301004e0100004a03031234567890abcdef',
        'fedcba0987654321fedcba0987654321fedcba09'
      ];

      const result = inputFormatter.formatTLSHandshake(messages);

      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBe(2);
    });

    it('should truncate long messages to 62 hex characters', () => {
      const longMessage = '0x' + '1234567890abcdef'.repeat(10);
      const messages = [longMessage];

      const result = inputFormatter.formatTLSHandshake(messages);

      expect(result.length).toBe(1);
      expect(result[0]).toMatch(/^\d+$/);
    });

    it('should handle empty array', () => {
      const result = inputFormatter.formatTLSHandshake([]);

      expect(result).toEqual([]);
    });
  });

  describe('formatCertificate', () => {
    it('should format base64 certificate', () => {
      const certificate = Buffer.from('test certificate data').toString('base64');
      const result = inputFormatter.formatCertificate(certificate);

      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBeGreaterThan(0);
      result.forEach(element => {
        expect(element).toMatch(/^\d+$/);
      });
    });

    it('should handle empty certificate', () => {
      const result = inputFormatter.formatCertificate('');

      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBeGreaterThan(0);
    });

    it('should produce consistent hashes for same certificate', () => {
      const certificate = Buffer.from('test certificate').toString('base64');
      const result1 = inputFormatter.formatCertificate(certificate);
      const result2 = inputFormatter.formatCertificate(certificate);

      expect(result1).toEqual(result2);
    });

    it('should produce different hashes for different certificates', () => {
      const cert1 = Buffer.from('certificate 1').toString('base64');
      const cert2 = Buffer.from('certificate 2').toString('base64');

      const result1 = inputFormatter.formatCertificate(cert1);
      const result2 = inputFormatter.formatCertificate(cert2);

      expect(result1).not.toEqual(result2);
    });
  });

  describe('validateInput', () => {
    it('should validate correct input structure', () => {
      const validInput = {
        timestamp: '1640995200',
        balance: '123456',
        followers: ['12345', '67890'],
        verified: '1'
      };

      const result = inputFormatter.validateInput(validInput);
      expect(result).toBe(true);
    });

    it('should reject input with null values', () => {
      const invalidInput = {
        timestamp: '1640995200',
        balance: null,
        followers: '12345'
      };

      const result = inputFormatter.validateInput(invalidInput);
      expect(result).toBe(false);
    });

    it('should reject input with undefined values', () => {
      const invalidInput = {
        timestamp: '1640995200',
        balance: undefined,
        followers: '12345'
      };

      const result = inputFormatter.validateInput(invalidInput);
      expect(result).toBe(false);
    });

    it('should reject arrays with invalid field elements', () => {
      const invalidInput = {
        timestamp: '1640995200',
        followers: ['12345', 'invalid', '67890']
      };

      const result = inputFormatter.validateInput(invalidInput);
      expect(result).toBe(false);
    });

    it('should reject strings that are not valid field elements', () => {
      const invalidInput = {
        timestamp: '1640995200',
        balance: 'invalid123'
      };

      const result = inputFormatter.validateInput(invalidInput);
      expect(result).toBe(false);
    });

    it('should accept empty arrays', () => {
      const validInput = {
        timestamp: '1640995200',
        followers: []
      };

      const result = inputFormatter.validateInput(validInput);
      expect(result).toBe(true);
    });

    it('should handle mixed valid and invalid field elements in arrays', () => {
      const invalidInput = {
        numbers: ['123', '456', 'abc'],
        timestamp: '1640995200'
      };

      const result = inputFormatter.validateInput(invalidInput);
      expect(result).toBe(false);
    });

    it('should validate negative numbers as valid field elements', () => {
      const validInput = {
        balance: '-123456',
        timestamp: '1640995200'
      };

      const result = inputFormatter.validateInput(validInput);
      expect(result).toBe(true);
    });

    it('should reject decimal numbers in field elements', () => {
      const invalidInput = {
        balance: '123.456',
        timestamp: '1640995200'
      };

      const result = inputFormatter.validateInput(invalidInput);
      expect(result).toBe(false);
    });
  });

  describe('Error Handling', () => {
    it('should handle malformed TLS data gracefully', () => {
      const malformedTLS = {
        ...mockTLSData,
        sessionKeys: {
          clientRandom: 'invalid-hex',
          serverRandom: '0xvalid123',
          masterSecret: '0x123'
        }
      };

      expect(() => {
        inputFormatter.formatInput(mockExtractedData, malformedTLS, 'test');
      }).not.toThrow();
    });

    it('should handle missing processed data gracefully', () => {
      const dataWithoutProcessed = {
        ...mockExtractedData,
        processed: {}
      };

      const result = inputFormatter.formatInput(dataWithoutProcessed, mockTLSData, 'balanceGreaterThan');
      expect(result).toBeDefined();
      expect(result.balance).toBe('0'); // Should default missing values
    });

    it('should handle invalid claim types gracefully', () => {
      const result = inputFormatter.formatInput(mockExtractedData, mockTLSData, '');
      expect(result).toBeDefined();
      expect(result.claimResult).toBe('1');
    });
  });

  describe('Edge Cases', () => {
    it('should handle very large numbers', () => {
      const largeNumber = Number.MAX_SAFE_INTEGER;
      mockExtractedData.processed.large = largeNumber;

      const result = inputFormatter.formatInput(mockExtractedData, mockTLSData, 'test');
      expect(result.large).toBe(largeNumber.toString());
    });

    it('should handle special characters in strings', () => {
      const specialString = 'Special chars: !@#$%^&*()_+{}[]|\\:";\'<>?,./';
      mockExtractedData.processed.special = specialString;

      const result = inputFormatter.formatInput(mockExtractedData, mockTLSData, 'test');
      expect(Array.isArray(result.special)).toBe(true);
    });

    it('should handle zero values correctly', () => {
      mockExtractedData.processed.zero = 0;
      mockExtractedData.processed.zeroString = '0';

      const result = inputFormatter.formatInput(mockExtractedData, mockTLSData, 'test');
      expect(result.zero).toBe('0');
      expect(Array.isArray(result.zeroString)).toBe(true);
    });

    it('should handle boundary values for parseAmount', () => {
      expect(inputFormatter['parseAmount'](0.01)).toBe('1');
      expect(inputFormatter['parseAmount'](0.004)).toBe('0'); // Rounds down
      expect(inputFormatter['parseAmount'](0.005)).toBe('1'); // Rounds up
    });
  });
});