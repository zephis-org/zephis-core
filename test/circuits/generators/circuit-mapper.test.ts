import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CircuitMapper } from '../../../src/circuits/generators/circuit-mapper';
import { Template, ExtractedData, TLSSessionData } from '../../../src/types';

vi.mock('../../../src/utils/logger', () => ({
  default: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn()
  }
}));

describe('CircuitMapper', () => {
  let circuitMapper: CircuitMapper;
  let mockTemplate: Template;
  let mockExtractedData: ExtractedData;
  let mockTLSData: TLSSessionData;

  beforeEach(() => {
    circuitMapper = new CircuitMapper();

    mockTemplate = {
      domain: 'example.com',
      name: 'Example Template',
      selectors: {
        balance: '.balance',
        username: '.username'
      },
      extractors: {
        balance: 'el => parseFloat(el.textContent.replace(/[^0-9.]/g, ""))',
        username: 'el => el.textContent'
      }
    };

    mockExtractedData = {
      raw: {
        balance: '$1,234.56',
        username: 'testuser'
      },
      processed: {
        balance: 1234.56,
        username: 'testuser'
      },
      timestamp: Date.now(),
      url: 'https://example.com/account',
      domain: 'example.com'
    };

    mockTLSData = {
      serverCertificate: 'mock-cert',
      sessionKeys: {
        clientRandom: '0x123' as any,
        serverRandom: '0x456' as any,
        masterSecret: '0x789' as any
      },
      handshakeMessages: ['0xabc' as any],
      timestamp: Date.now()
    };
  });

  describe('convertToCircuitInput', () => {
    it('should convert data to circuit input for numeric comparison claim', () => {
      const claim = 'balanceGreaterThan';
      const params = { amount: 1000 };

      const result = circuitMapper.convertToCircuitInput(
        mockTemplate,
        mockExtractedData,
        mockTLSData,
        claim,
        params
      );

      expect(result).toMatchObject({
        dataHash: expect.any(String),
        claimHash: expect.any(String),
        templateHash: expect.any(String),
        threshold: 1000,
        timestamp: expect.any(Number),
        data: expect.any(Array),
        claim: expect.any(Array),
        dataType: 0, // numeric
        claimType: 0, // comparison
        actualValue: 1234
      });

      expect(result.data.length).toBe(32);
      expect(result.claim.length).toBe(16);
    });

    it('should handle boolean existence claims', () => {
      const claim = 'hasVerifiedBadge';
      const params = {};

      mockExtractedData.raw.verifiedBadge = true;

      const result = circuitMapper.convertToCircuitInput(
        mockTemplate,
        mockExtractedData,
        mockTLSData,
        claim,
        params
      );

      expect(result).toMatchObject({
        dataType: 2, // boolean
        claimType: 1, // existence
        actualValue: 1 // true converted to 1
      });
    });

    it('should handle pattern matching claims', () => {
      const claim = 'currencyCheck';
      const params = { expectedCurrency: 'USD' };

      mockExtractedData.raw.currency = 'USD';

      const result = circuitMapper.convertToCircuitInput(
        mockTemplate,
        mockExtractedData,
        mockTLSData,
        claim,
        params
      );

      expect(result).toMatchObject({
        dataType: 1, // string
        claimType: 2, // pattern
        actualValue: 1 // match
      });
    });

    it('should handle followers count claim', () => {
      const claim = 'followersGreaterThan';
      const params = { count: 1000 };

      mockExtractedData.raw.followers = '10.5K';

      const result = circuitMapper.convertToCircuitInput(
        mockTemplate,
        mockExtractedData,
        mockTLSData,
        claim,
        params
      );

      expect(result).toMatchObject({
        dataType: 0, // numeric
        claimType: 0, // comparison
        threshold: 1000,
        actualValue: 10500
      });
    });

    it('should handle missing data gracefully', () => {
      const claim = 'unknownClaim';
      const params = {};

      const result = circuitMapper.convertToCircuitInput(
        mockTemplate,
        mockExtractedData,
        mockTLSData,
        claim,
        params
      );

      expect(result).toMatchObject({
        actualValue: 0,
        threshold: 0
      });
    });

    it('should handle isInfluencer claim', () => {
      const claim = 'isInfluencer';
      const params = {};

      mockExtractedData.raw.followers = '25K';

      const result = circuitMapper.convertToCircuitInput(
        mockTemplate,
        mockExtractedData,
        mockTLSData,
        claim,
        params
      );

      expect(result).toMatchObject({
        dataType: 2, // boolean
        claimType: 1, // existence
        actualValue: 1 // has >10k followers
      });
    });

    it('should handle hasRecentActivity claim', () => {
      const claim = 'hasRecentActivity';
      const params = {};

      // Set last activity to 5 days ago
      const fiveDaysAgo = new Date();
      fiveDaysAgo.setDate(fiveDaysAgo.getDate() - 5);
      mockExtractedData.raw.lastActivity = fiveDaysAgo.toISOString();

      const result = circuitMapper.convertToCircuitInput(
        mockTemplate,
        mockExtractedData,
        mockTLSData,
        claim,
        params
      );

      expect(result).toMatchObject({
        dataType: 2, // boolean
        claimType: 1, // existence
        actualValue: 1 // activity within 30 days
      });
    });

    it('should handle old activity correctly', () => {
      const claim = 'hasRecentActivity';
      const params = {};

      // Set last activity to 45 days ago
      const oldDate = new Date();
      oldDate.setDate(oldDate.getDate() - 45);
      mockExtractedData.raw.lastActivity = oldDate.toISOString();

      const result = circuitMapper.convertToCircuitInput(
        mockTemplate,
        mockExtractedData,
        mockTLSData,
        claim,
        params
      );

      expect(result).toMatchObject({
        actualValue: 0 // no recent activity
      });
    });
  });

  describe('validateCircuitInput', () => {
    it('should validate correct circuit input', () => {
      const circuitInput = {
        dataHash: '12345',
        claimHash: '67890',
        templateHash: '11111',
        threshold: 1000,
        timestamp: Math.floor(Date.now() / 1000),
        data: new Array(32).fill(0),
        claim: new Array(16).fill(0),
        dataType: 0,
        claimType: 0,
        actualValue: 1234
      };

      const result = circuitMapper.validateCircuitInput(circuitInput);
      expect(result).toBe(true);
    });

    it('should reject missing hash fields', () => {
      const circuitInput = {
        dataHash: '',
        claimHash: '67890',
        templateHash: '11111',
        threshold: 1000,
        timestamp: Math.floor(Date.now() / 1000),
        data: new Array(32).fill(0),
        claim: new Array(16).fill(0),
        dataType: 0,
        claimType: 0,
        actualValue: 1234
      };

      const result = circuitMapper.validateCircuitInput(circuitInput);
      expect(result).toBe(false);
    });

    it('should reject arrays that are too long', () => {
      const circuitInput = {
        dataHash: '12345',
        claimHash: '67890',
        templateHash: '11111',
        threshold: 1000,
        timestamp: Math.floor(Date.now() / 1000),
        data: new Array(50).fill(0), // Too long
        claim: new Array(16).fill(0),
        dataType: 0,
        claimType: 0,
        actualValue: 1234
      };

      const result = circuitMapper.validateCircuitInput(circuitInput);
      expect(result).toBe(false);
    });

    it('should reject invalid timestamps', () => {
      const circuitInput = {
        dataHash: '12345',
        claimHash: '67890',
        templateHash: '11111',
        threshold: 1000,
        timestamp: Math.floor(Date.now() / 1000) + 10000, // Too far in the future
        data: new Array(32).fill(0),
        claim: new Array(16).fill(0),
        dataType: 0,
        claimType: 0,
        actualValue: 1234
      };

      const result = circuitMapper.validateCircuitInput(circuitInput);
      expect(result).toBe(false);
    });

    it('should reject invalid data type values', () => {
      const circuitInput = {
        dataHash: '12345',
        claimHash: '67890',
        templateHash: '11111',
        threshold: 1000,
        timestamp: Math.floor(Date.now() / 1000),
        data: new Array(32).fill(0),
        claim: new Array(16).fill(0),
        dataType: 5, // Invalid
        claimType: 0,
        actualValue: 1234
      };

      const result = circuitMapper.validateCircuitInput(circuitInput);
      expect(result).toBe(false);
    });

    it('should reject invalid claim type values', () => {
      const circuitInput = {
        dataHash: '12345',
        claimHash: '67890',
        templateHash: '11111',
        threshold: 1000,
        timestamp: Math.floor(Date.now() / 1000),
        data: new Array(32).fill(0),
        claim: new Array(16).fill(0),
        dataType: 0,
        claimType: 10, // Invalid
        actualValue: 1234
      };

      const result = circuitMapper.validateCircuitInput(circuitInput);
      expect(result).toBe(false);
    });
  });

  describe('edge cases', () => {
    it('should handle empty extracted data', () => {
      const emptyData: ExtractedData = {
        raw: {},
        processed: {},
        timestamp: Date.now(),
        url: '',
        domain: ''
      };

      const result = circuitMapper.convertToCircuitInput(
        mockTemplate,
        emptyData,
        mockTLSData,
        'balanceGreaterThan',
        { amount: 100 }
      );

      expect(result.actualValue).toBe(0);
      expect(result.data).toHaveLength(32);
    });

    it('should handle malformed follower counts', () => {
      mockExtractedData.raw.followers = 'abc123xyz';

      const result = circuitMapper.convertToCircuitInput(
        mockTemplate,
        mockExtractedData,
        mockTLSData,
        'followersGreaterThan',
        { count: 100 }
      );

      expect(result.actualValue).toBe(0);
    });

    it('should handle very large numbers correctly', () => {
      mockExtractedData.raw.followers = '999.9M';

      const result = circuitMapper.convertToCircuitInput(
        mockTemplate,
        mockExtractedData,
        mockTLSData,
        'followersGreaterThan',
        { count: 1000000 }
      );

      expect(result.actualValue).toBe(999900000);
    });

    it('should handle currency with decimals correctly', () => {
      mockExtractedData.raw.balance = '$99,999.99';

      const result = circuitMapper.convertToCircuitInput(
        mockTemplate,
        mockExtractedData,
        mockTLSData,
        'balanceGreaterThan',
        { amount: 50000 }
      );

      expect(result.actualValue).toBe(99999); // Floor of the value
    });

    it('should handle alternative balance field names', () => {
      delete mockExtractedData.raw.balance;
      mockExtractedData.raw.availableBalance = '$5,000.00';

      const result = circuitMapper.convertToCircuitInput(
        mockTemplate,
        mockExtractedData,
        mockTLSData,
        'balanceGreaterThan',
        { amount: 1000 }
      );

      expect(result.actualValue).toBe(5000);
    });

    it('should handle verified account text check', () => {
      mockExtractedData.raw.accountStatus = 'VERIFIED USER';

      const result = circuitMapper.convertToCircuitInput(
        mockTemplate,
        mockExtractedData,
        mockTLSData,
        'isVerifiedAccount',
        {}
      );

      expect(result.actualValue).toBe(1);
    });

    it('should handle non-verified account status', () => {
      mockExtractedData.raw.accountStatus = 'pending';

      const result = circuitMapper.convertToCircuitInput(
        mockTemplate,
        mockExtractedData,
        mockTLSData,
        'isVerifiedAccount',
        {}
      );

      expect(result.actualValue).toBe(0);
    });
  });
});