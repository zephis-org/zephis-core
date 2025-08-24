import { describe, it, expect, beforeEach } from 'vitest';
import { ProofFormatter } from '../../src/proof/proof-formatter';

describe('ProofFormatter', () => {
  let formatter: ProofFormatter;
  let mockProof: any;

  beforeEach(() => {
    formatter = new ProofFormatter();
    mockProof = {
      proof: {
        a: ['1', '2'],
        b: [['3', '4'], ['5', '6']],
        c: ['7', '8']
      },
      publicInputs: ['100', '200'],
      metadata: {
        sessionId: 'session-123',
        template: 'test-template',
        claim: 'test-claim',
        timestamp: 1234567890,
        domain: 'test.com',
        circuitId: 'test-circuit'
      }
    };
  });

  describe('formatForChain', () => {
    it('should format proof for blockchain submission', () => {
      const formatted = formatter.formatForChain(mockProof);

      expect(formatted).toEqual({
        proofData: [
          BigInt(1), BigInt(2),
          BigInt(4), BigInt(3),
          BigInt(6), BigInt(5),
          BigInt(7), BigInt(8)
        ],
        publicSignals: [BigInt(100), BigInt(200)],
        metadata: mockProof.metadata
      });
    });

    it('should handle proof with different array structures', () => {
      const complexProof = {
        ...mockProof,
        proof: {
          a: ['10', '20', '30'],
          b: [['40', '50'], ['60', '70'], ['80', '90']],
          c: ['100', '110', '120']
        }
      };

      const formatted = formatter.formatForChain(complexProof);

      expect(formatted.proofData).toHaveLength(8);
      expect(formatted.proofData[0]).toBe(BigInt(10));
      expect(formatted.proofData[1]).toBe(BigInt(20));
    });

    it('should preserve metadata', () => {
      const formatted = formatter.formatForChain(mockProof);

      expect(formatted.metadata).toEqual(mockProof.metadata);
    });
  });

  describe('formatForStorage', () => {
    it('should format proof for storage', () => {
      const formatted = formatter.formatForStorage(mockProof);

      expect(formatted).toEqual({
        id: expect.stringMatching(/^[0-9a-f]{64}$/),
        proof: mockProof.proof,
        publicInputs: mockProof.publicInputs,
        metadata: {
          ...mockProof.metadata,
          storedAt: expect.any(Number)
        }
      });
    });

    it('should generate unique ID based on proof content', () => {
      const formatted1 = formatter.formatForStorage(mockProof);
      const formatted2 = formatter.formatForStorage(mockProof);

      // Same proof should generate same ID
      expect(formatted1.id).toBe(formatted2.id);

      // Different proof should generate different ID
      const differentProof = {
        ...mockProof,
        proof: { ...mockProof.proof, a: ['9', '10'] }
      };
      const formatted3 = formatter.formatForStorage(differentProof);
      expect(formatted3.id).not.toBe(formatted1.id);
    });

    it('should add storage timestamp', () => {
      const beforeTime = Date.now();
      const formatted = formatter.formatForStorage(mockProof);
      const afterTime = Date.now();

      expect(formatted.metadata.storedAt).toBeGreaterThanOrEqual(beforeTime);
      expect(formatted.metadata.storedAt).toBeLessThanOrEqual(afterTime);
    });
  });

  describe('formatForPresentation', () => {
    it('should format proof for human-readable presentation', () => {
      const formatted = formatter.formatForPresentation(mockProof);

      expect(formatted).toEqual({
        sessionId: 'session-123',
        template: 'test-template',
        claim: 'test-claim',
        domain: 'test.com',
        timestamp: new Date(1234567890).toISOString(),
        proofSummary: {
          valid: true,
          publicInputs: ['100', '200'],
          circuitId: 'test-circuit'
        }
      });
    });

    it('should handle missing metadata fields', () => {
      const minimalProof = {
        proof: mockProof.proof,
        publicInputs: mockProof.publicInputs,
        metadata: {
          sessionId: 'session-123'
        }
      };

      const formatted = formatter.formatForPresentation(minimalProof);

      expect(formatted.sessionId).toBe('session-123');
      expect(formatted.template).toBe('unknown');
      expect(formatted.claim).toBe('unknown');
      expect(formatted.domain).toBe('unknown');
    });
  });

  describe('parseFromChain', () => {
    it('should parse proof from blockchain format', () => {
      const chainFormat = {
        proofData: [
          BigInt(1), BigInt(2),
          BigInt(4), BigInt(3),
          BigInt(6), BigInt(5),
          BigInt(7), BigInt(8)
        ],
        publicSignals: [BigInt(100), BigInt(200)],
        metadata: mockProof.metadata
      };

      const parsed = formatter.parseFromChain(chainFormat);

      expect(parsed).toEqual({
        proof: {
          a: ['1', '2'],
          b: [['3', '4'], ['5', '6']],
          c: ['7', '8']
        },
        publicInputs: ['100', '200'],
        metadata: mockProof.metadata
      });
    });

    it('should handle invalid proof data length', () => {
      const invalidFormat = {
        proofData: [BigInt(1), BigInt(2)], // Too short
        publicSignals: [BigInt(100)],
        metadata: {}
      };

      expect(() => formatter.parseFromChain(invalidFormat))
        .toThrow('Invalid proof data length');
    });
  });

  describe('parseFromStorage', () => {
    it('should parse proof from storage format', () => {
      const storageFormat = {
        id: 'abc123',
        proof: mockProof.proof,
        publicInputs: mockProof.publicInputs,
        metadata: {
          ...mockProof.metadata,
          storedAt: 1234567890
        }
      };

      const parsed = formatter.parseFromStorage(storageFormat);

      expect(parsed).toEqual({
        proof: mockProof.proof,
        publicInputs: mockProof.publicInputs,
        metadata: mockProof.metadata
      });
    });

    it('should remove storage-specific metadata', () => {
      const storageFormat = {
        id: 'abc123',
        proof: mockProof.proof,
        publicInputs: mockProof.publicInputs,
        metadata: {
          ...mockProof.metadata,
          storedAt: 1234567890,
          storageLocation: 's3://bucket/path'
        }
      };

      const parsed = formatter.parseFromStorage(storageFormat);

      expect(parsed.metadata.storedAt).toBeUndefined();
      expect(parsed.metadata.storageLocation).toBeUndefined();
    });
  });

  describe('validateFormat', () => {
    it('should validate correct proof format', () => {
      expect(formatter.validateFormat(mockProof)).toBe(true);
    });

    it('should reject proof without required fields', () => {
      const invalidProof1 = { ...mockProof, proof: undefined };
      const invalidProof2 = { ...mockProof, publicInputs: undefined };
      const invalidProof3 = { proof: mockProof.proof };

      expect(formatter.validateFormat(invalidProof1)).toBe(false);
      expect(formatter.validateFormat(invalidProof2)).toBe(false);
      expect(formatter.validateFormat(invalidProof3)).toBe(false);
    });

    it('should reject proof with invalid structure', () => {
      const invalidProof = {
        ...mockProof,
        proof: {
          a: '123', // Should be array
          b: [['3', '4'], ['5', '6']],
          c: ['7', '8']
        }
      };

      expect(formatter.validateFormat(invalidProof)).toBe(false);
    });
  });

  describe('compressProof', () => {
    it('should compress proof data', () => {
      const compressed = formatter.compressProof(mockProof);

      expect(compressed).toEqual({
        p: {
          a: ['1', '2'],
          b: [['3', '4'], ['5', '6']],
          c: ['7', '8']
        },
        i: ['100', '200'],
        m: {
          s: 'session-123',
          t: 'test-template',
          c: 'test-claim',
          ts: 1234567890,
          d: 'test.com',
          ci: 'test-circuit'
        }
      });
    });
  });

  describe('decompressProof', () => {
    it('should decompress proof data', () => {
      const compressed = {
        p: {
          a: ['1', '2'],
          b: [['3', '4'], ['5', '6']],
          c: ['7', '8']
        },
        i: ['100', '200'],
        m: {
          s: 'session-123',
          t: 'test-template',
          c: 'test-claim',
          ts: 1234567890,
          d: 'test.com',
          ci: 'test-circuit'
        }
      };

      const decompressed = formatter.decompressProof(compressed);

      expect(decompressed).toEqual(mockProof);
    });
  });

  describe('toJSON', () => {
    it('should convert proof to JSON string', () => {
      const json = formatter.toJSON(mockProof);
      const parsed = JSON.parse(json);

      expect(parsed).toEqual(mockProof);
    });

    it('should produce valid JSON', () => {
      const json = formatter.toJSON(mockProof);
      
      expect(() => JSON.parse(json)).not.toThrow();
    });
  });

  describe('fromJSON', () => {
    it('should parse proof from JSON string', () => {
      const json = JSON.stringify(mockProof);
      const parsed = formatter.fromJSON(json);

      expect(parsed).toEqual(mockProof);
    });

    it('should handle invalid JSON', () => {
      expect(() => formatter.fromJSON('invalid json'))
        .toThrow('Invalid JSON format');
    });

    it('should validate parsed proof format', () => {
      const invalidProof = { ...mockProof, proof: undefined };
      const json = JSON.stringify(invalidProof);

      expect(() => formatter.fromJSON(json))
        .toThrow('Invalid proof format');
    });
  });
});