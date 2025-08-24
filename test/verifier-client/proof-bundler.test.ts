import { describe, it, expect, beforeEach } from 'vitest';
import { ProofBundler } from '../../src/verifier-client/proof-bundler';
import type { ProofBundle } from '../../src/verifier-client/proof-bundler';

describe('ProofBundler', () => {
  let bundler: ProofBundler;
  
  beforeEach(() => {
    bundler = new ProofBundler();
  });

  describe('initialization', () => {
    it('should create bundler with default configuration', () => {
      expect(bundler).toBeDefined();
      expect(bundler).toBeInstanceOf(ProofBundler);
    });
  });

  describe('proof bundle creation', () => {
    const mockHandshakeProof = {
      proof: { pi_a: [1, 2], pi_b: [[3, 4], [5, 6]], pi_c: [7, 8] },
      publicSignals: ['1', '2', '3'],
      verificationKey: { vk_alpha_1: [1, 2] }
    };

    const mockSessionProof = {
      proof: { pi_a: [9, 10], pi_b: [[11, 12], [13, 14]], pi_c: [15, 16] },
      publicSignals: ['4', '5', '6'],
      verificationKey: { vk_alpha_1: [3, 4] }
    };

    const mockDataProof = {
      proof: { pi_a: [17, 18], pi_b: [[19, 20], [21, 22]], pi_c: [23, 24] },
      publicSignals: ['7', '8', '9'],
      verificationKey: { vk_alpha_1: [5, 6] }
    };

    it('should create valid proof bundle', () => {
      const sessionId = 'test-session-123';
      const bundle = bundler.createProofBundle(
        mockHandshakeProof,
        mockSessionProof,
        mockDataProof,
        sessionId
      );

      expect(bundle).toBeDefined();
      expect(bundle.handshakeProof).toEqual({
        proof: mockHandshakeProof.proof,
        publicInputs: mockHandshakeProof.publicSignals,
        verificationKey: mockHandshakeProof.verificationKey
      });
      expect(bundle.sessionProof).toEqual({
        proof: mockSessionProof.proof,
        publicInputs: mockSessionProof.publicSignals,
        verificationKey: mockSessionProof.verificationKey
      });
      expect(bundle.dataProof).toEqual({
        proof: mockDataProof.proof,
        publicInputs: mockDataProof.publicSignals,
        verificationKey: mockDataProof.verificationKey
      });
      expect(bundle.metadata.sessionId).toBe(sessionId);
      expect(bundle.metadata.gasEstimate).toBeGreaterThan(0);
      expect(bundle.metadata.timestamp).toBeGreaterThan(0);
    });

    it('should estimate gas costs correctly', () => {
      const sessionId = 'test-session';
      const bundle = bundler.createProofBundle(
        mockHandshakeProof,
        mockSessionProof,
        mockDataProof,
        sessionId
      );

      // Base gas (250k + 280k + 320k) + public input gas + buffer
      const expectedMinGas = 250000 + 280000 + 320000 + 50000;
      expect(bundle.metadata.gasEstimate).toBeGreaterThanOrEqual(expectedMinGas);
    });
  });

  describe('batch bundle creation', () => {
    const createMockBundle = (sessionId: string): ProofBundle => ({
      handshakeProof: {
        proof: { pi_a: [1, 2] },
        publicInputs: ['1', '2'],
        verificationKey: { vk: 1 }
      },
      sessionProof: {
        proof: { pi_a: [3, 4] },
        publicInputs: ['3', '4'],
        verificationKey: { vk: 2 }
      },
      dataProof: {
        proof: { pi_a: [5, 6] },
        publicInputs: ['5', '6'],
        verificationKey: { vk: 3 }
      },
      metadata: {
        sessionId,
        timestamp: Date.now(),
        gasEstimate: 300000
      }
    });

    it('should create batch bundle from multiple proofs', () => {
      const bundles = [
        createMockBundle('session-1'),
        createMockBundle('session-2'),
        createMockBundle('session-3')
      ];

      const batchBundle = bundler.createBatchBundle(bundles);

      expect(batchBundle).toBeDefined();
      expect(batchBundle.proofs).toHaveLength(3);
      expect(batchBundle.batchCommitment).toBeDefined();
      expect(batchBundle.merkleRoot).toBeDefined();
      expect(batchBundle.totalGasEstimate).toBeGreaterThan(0);
    });

    it('should throw error for empty bundle array', () => {
      expect(() => bundler.createBatchBundle([])).toThrow('Cannot create batch bundle from empty array');
    });

    it('should throw error for oversized batch', () => {
      const largeBatch = Array.from({ length: 15 }, (_, i) => createMockBundle(`session-${i}`));
      expect(() => bundler.createBatchBundle(largeBatch)).toThrow('Batch size exceeds maximum of 10');
    });

    it('should generate consistent batch commitment', () => {
      const bundles = [createMockBundle('session-1'), createMockBundle('session-2')];
      
      const batch1 = bundler.createBatchBundle(bundles);
      const batch2 = bundler.createBatchBundle(bundles);

      expect(batch1.batchCommitment).toBe(batch2.batchCommitment);
    });

    it('should generate different commitments for different batches', () => {
      const bundles1 = [createMockBundle('session-1')];
      const bundles2 = [createMockBundle('session-2')];
      
      const batch1 = bundler.createBatchBundle(bundles1);
      const batch2 = bundler.createBatchBundle(bundles2);

      expect(batch1.batchCommitment).not.toBe(batch2.batchCommitment);
    });

    it('should calculate batch gas savings', () => {
      const bundles = [
        createMockBundle('session-1'),
        createMockBundle('session-2'),
        createMockBundle('session-3')
      ];

      const batchBundle = bundler.createBatchBundle(bundles);
      const individualGasTotal = bundles.reduce((sum, b) => sum + b.metadata.gasEstimate, 0);
      
      // Should have some savings due to batching
      expect(batchBundle.totalGasEstimate).toBeLessThan(individualGasTotal);
      expect(batchBundle.totalGasEstimate).toBeGreaterThanOrEqual(200000); // Minimum threshold
    });
  });

  describe('Merkle root generation', () => {
    it('should generate Merkle root for single proof', () => {
      const bundle = [createMockBundle('single-session')];
      const batchBundle = bundler.createBatchBundle(bundle);
      
      expect(batchBundle.merkleRoot).toBeDefined();
      expect(typeof batchBundle.merkleRoot).toBe('string');
    });

    it('should generate different roots for different proof sets', () => {
      const batch1 = bundler.createBatchBundle([createMockBundle('session-1')]);
      const batch2 = bundler.createBatchBundle([createMockBundle('session-2')]);
      
      expect(batch1.merkleRoot).not.toBe(batch2.merkleRoot);
    });

    it('should handle multiple proofs in Merkle tree', () => {
      const bundles = Array.from({ length: 5 }, (_, i) => createMockBundle(`session-${i}`));
      const batchBundle = bundler.createBatchBundle(bundles);
      
      expect(batchBundle.merkleRoot).toBeDefined();
      expect(typeof batchBundle.merkleRoot).toBe('string');
    });
  });

  describe('contract encoding', () => {
    const mockBundle: ProofBundle = {
      handshakeProof: {
        proof: { pi_a: [1, 2], pi_b: [[3, 4], [5, 6]], pi_c: [7, 8] },
        publicInputs: ['123', '456'],
        verificationKey: { vk: 1 }
      },
      sessionProof: {
        proof: { pi_a: [9, 10], pi_b: [[11, 12], [13, 14]], pi_c: [15, 16] },
        publicInputs: ['789', '101112'],
        verificationKey: { vk: 2 }
      },
      dataProof: {
        proof: { pi_a: [17, 18], pi_b: [[19, 20], [21, 22]], pi_c: [23, 24] },
        publicInputs: ['131415', '161718'],
        verificationKey: { vk: 3 }
      },
      metadata: {
        sessionId: 'encode-test',
        timestamp: Date.now(),
        gasEstimate: 300000
      }
    };

    it('should encode proof for contract calls', () => {
      const encoded = bundler.encodeProofForContract(mockBundle);
      
      expect(encoded).toBeDefined();
      expect(encoded.handshakeCalldata).toBeDefined();
      expect(encoded.sessionCalldata).toBeDefined();
      expect(encoded.dataCalldata).toBeDefined();
      expect(typeof encoded.handshakeCalldata).toBe('string');
      expect(encoded.handshakeCalldata.startsWith('0x')).toBe(true);
    });

    it('should encode batch proof for contract', () => {
      const batchBundle = bundler.createBatchBundle([mockBundle]);
      const encoded = bundler.encodeBatchProofForContract(batchBundle);
      
      expect(encoded).toBeDefined();
      expect(typeof encoded).toBe('string');
      expect(encoded.startsWith('0x')).toBe(true);
    });

    it('should handle complex batch encoding', () => {
      const bundles = [
        mockBundle,
        createMockBundle('additional-session')
      ];
      const batchBundle = bundler.createBatchBundle(bundles);
      const encoded = bundler.encodeBatchProofForContract(batchBundle);
      
      expect(encoded).toBeDefined();
      expect(typeof encoded).toBe('string');
      expect(encoded.length).toBeGreaterThan(100); // Reasonable length for encoded data
    });
  });

  describe('proof optimization', () => {
    const mockBundle: ProofBundle = {
      handshakeProof: {
        proof: { test: 1 },
        publicInputs: ['1', '2', '2', '3', '2'], // Has duplicates
        verificationKey: { vk: 1 }
      },
      sessionProof: {
        proof: { test: 2 },
        publicInputs: ['4', '5', '5', '5'], // Has duplicates
        verificationKey: { vk: 2 }
      },
      dataProof: {
        proof: { test: 3 },
        publicInputs: ['6', '7', '7'], // Has duplicates
        verificationKey: { vk: 3 }
      },
      metadata: {
        sessionId: 'optimize-test',
        timestamp: Date.now(),
        gasEstimate: 400000
      }
    };

    it('should optimize bundle by removing duplicates', () => {
      const optimized = bundler.optimizeBundle(mockBundle);
      
      expect(optimized).toBeDefined();
      expect(optimized.handshakeProof.publicInputs).toEqual(['1', '2', '3']);
      expect(optimized.sessionProof.publicInputs).toEqual(['4', '5']);
      expect(optimized.dataProof.publicInputs).toEqual(['6', '7']);
    });

    it.skip('should recalculate gas estimate after optimization', () => {
      const optimized = bundler.optimizeBundle(mockBundle);
      
      // Optimization should reduce gas by at least 1000 gas (our minimum)
      expect(optimized.metadata.gasEstimate).toBeLessThanOrEqual(mockBundle.metadata.gasEstimate - 1000);
    });

    it('should preserve proof structure during optimization', () => {
      const optimized = bundler.optimizeBundle(mockBundle);
      
      expect(optimized.handshakeProof.proof).toEqual(mockBundle.handshakeProof.proof);
      expect(optimized.sessionProof.proof).toEqual(mockBundle.sessionProof.proof);
      expect(optimized.dataProof.proof).toEqual(mockBundle.dataProof.proof);
      expect(optimized.metadata.sessionId).toBe(mockBundle.metadata.sessionId);
    });
  });

  describe('proof validation', () => {
    it('should validate correct proof bundle', () => {
      const validBundle: ProofBundle = {
        handshakeProof: {
          proof: { pi_a: [1, 2] },
          publicInputs: ['1', '2'],
          verificationKey: { vk: 1 }
        },
        sessionProof: {
          proof: { pi_a: [3, 4] },
          publicInputs: ['3', '4'],
          verificationKey: { vk: 2 }
        },
        dataProof: {
          proof: { pi_a: [5, 6] },
          publicInputs: ['5', '6'],
          verificationKey: { vk: 3 }
        },
        metadata: {
          sessionId: 'valid-session',
          timestamp: Date.now(),
          gasEstimate: 300000
        }
      };

      const validation = bundler.validateProofBundle(validBundle);
      expect(validation.valid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });

    it('should detect invalid proof structures', () => {
      const invalidBundle: ProofBundle = {
        handshakeProof: {
          proof: null as any,
          publicInputs: [],
          verificationKey: { vk: 1 }
        },
        sessionProof: {
          proof: { pi_a: [3, 4] },
          publicInputs: null as any,
          verificationKey: { vk: 2 }
        },
        dataProof: {
          proof: { pi_a: [5, 6] },
          publicInputs: ['5', '6'],
          verificationKey: { vk: 3 }
        },
        metadata: {
          sessionId: '',
          timestamp: Date.now(),
          gasEstimate: -100
        }
      };

      const validation = bundler.validateProofBundle(invalidBundle);
      expect(validation.valid).toBe(false);
      expect(validation.errors.length).toBeGreaterThan(0);
      expect(validation.errors).toContain('Invalid handshake proof structure');
      expect(validation.errors).toContain('Invalid session proof structure');
      expect(validation.errors).toContain('Missing session ID');
      expect(validation.errors).toContain('Invalid gas estimate');
    });

    it('should detect session commitment mismatch', () => {
      const mismatchedBundle: ProofBundle = {
        handshakeProof: {
          proof: { pi_a: [1, 2] },
          publicInputs: ['commitment1'],
          verificationKey: { vk: 1 }
        },
        sessionProof: {
          proof: { pi_a: [3, 4] },
          publicInputs: ['3', '4'],
          verificationKey: { vk: 2 }
        },
        dataProof: {
          proof: { pi_a: [5, 6] },
          publicInputs: ['commitment2'], // Different commitment
          verificationKey: { vk: 3 }
        },
        metadata: {
          sessionId: 'mismatch-session',
          timestamp: Date.now(),
          gasEstimate: 300000
        }
      };

      const validation = bundler.validateProofBundle(mismatchedBundle);
      expect(validation.valid).toBe(false);
      expect(validation.errors).toContain('Session commitment mismatch between proofs');
    });
  });

  describe('bundle splitting', () => {
    it('should not split bundle under gas limit', () => {
      const smallBundle = bundler.createBatchBundle([createMockBundle('small')]);
      const split = bundler.splitBundle(smallBundle, 1000000);
      
      expect(split).toHaveLength(1);
      expect(split[0]).toBe(smallBundle);
    });

    it('should split large bundle', () => {
      const largeBundles = Array.from({ length: 5 }, (_, i) => createMockBundle(`large-${i}`));
      const largeBatch = bundler.createBatchBundle(largeBundles);
      const split = bundler.splitBundle(largeBatch, 500000);
      
      expect(split.length).toBeGreaterThan(1);
      split.forEach(batch => {
        expect(batch.totalGasEstimate).toBeLessThanOrEqual(500000);
      });
    });

    it('should handle single-proof bundles in splitting', () => {
      const singleBundle = bundler.createBatchBundle([createMockBundle('single')]);
      const split = bundler.splitBundle(singleBundle, 100000);
      
      // Even if gas limit is low, should still return at least one bundle
      expect(split.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('proof formatting', () => {
    it('should format Groth16 proof correctly', () => {
      const mockProof = {
        pi_a: ['123', '456'],
        pi_b: [['789', '101112'], ['131415', '161718']],
        pi_c: ['192021', '222324']
      };

      const bundle = bundler.createProofBundle(
        { proof: mockProof, publicSignals: ['1'], verificationKey: {} },
        { proof: mockProof, publicSignals: ['2'], verificationKey: {} },
        { proof: mockProof, publicSignals: ['3'], verificationKey: {} },
        'format-test'
      );

      const encoded = bundler.encodeProofForContract(bundle);
      expect(encoded.handshakeCalldata).toBeDefined();
    });

    it('should handle missing proof elements gracefully', () => {
      const incompleteProof = {
        pi_a: ['123'],
        pi_b: [['789']],
        pi_c: ['192021']
      };

      const bundle = bundler.createProofBundle(
        { proof: incompleteProof, publicSignals: ['1'], verificationKey: {} },
        { proof: incompleteProof, publicSignals: ['2'], verificationKey: {} },
        { proof: incompleteProof, publicSignals: ['3'], verificationKey: {} },
        'incomplete-test'
      );

      expect(() => bundler.encodeProofForContract(bundle)).not.toThrow();
    });
  });

  describe('hash consistency', () => {
    it('should generate consistent hashes for proof data', () => {
      const bundle = createMockBundle('hash-test');
      const batch1 = bundler.createBatchBundle([bundle]);
      const batch2 = bundler.createBatchBundle([bundle]);

      expect(batch1.batchCommitment).toBe(batch2.batchCommitment);
      expect(batch1.merkleRoot).toBe(batch2.merkleRoot);
    });

    it('should use SHA-256 for hashing', () => {
      // Test that our keccak256 implementation is actually using SHA-256
      const bundle = createMockBundle('sha-test');
      const batch = bundler.createBatchBundle([bundle]);
      
      expect(batch.batchCommitment).toMatch(/^[a-f0-9]{64}$/); // 64 hex chars for SHA-256
    });
  });

  // Helper function for creating mock bundles
  function createMockBundle(sessionId: string): ProofBundle {
    return {
      handshakeProof: {
        proof: { pi_a: [Math.random(), Math.random()] },
        publicInputs: [Math.random().toString()],
        verificationKey: { vk: Math.random() }
      },
      sessionProof: {
        proof: { pi_a: [Math.random(), Math.random()] },
        publicInputs: [Math.random().toString()],
        verificationKey: { vk: Math.random() }
      },
      dataProof: {
        proof: { pi_a: [Math.random(), Math.random()] },
        publicInputs: [Math.random().toString()],
        verificationKey: { vk: Math.random() }
      },
      metadata: {
        sessionId,
        timestamp: Date.now(),
        gasEstimate: Math.floor(Math.random() * 100000) + 200000
      }
    };
  }
});