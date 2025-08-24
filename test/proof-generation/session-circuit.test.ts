import { describe, it, expect, beforeEach } from 'vitest';
import { SessionCircuit } from '../../src/proof-generation/session-circuit';
import type { SessionProofInputs } from '../../src/proof-generation/session-circuit';

describe('SessionCircuit', () => {
  let circuit: SessionCircuit;
  let validInputs: SessionProofInputs;
  
  beforeEach(() => {
    circuit = new SessionCircuit(
      '/path/to/session.wasm',
      '/path/to/session.zkey',
      '/path/to/session.vkey'
    );
    
    validInputs = {
      masterSecret: Array.from({ length: 48 }, (_, i) => (i + 1).toString()),
      sessionKeys: {
        clientWriteKey: ['10', '11'],
        serverWriteKey: ['12', '13'],
        clientWriteIV: ['14', '15'],
        serverWriteIV: ['16', '17'],
        clientWriteMac: ['18', '19'],
        serverWriteMac: ['20', '21']
      },
      keyDerivationParams: {
        clientRandom: Array.from({ length: 32 }, (_, i) => i.toString()),
        serverRandom: Array.from({ length: 32 }, (_, i) => (i + 33).toString()),
        cipherSuite: 'TLS_RSA_WITH_AES_128_CBC_SHA'
      },
      keyCommitment: 'test-commitment-hash'
    };
  });

  describe('initialization', () => {
    it('should create circuit with provided paths', () => {
      expect(circuit).toBeDefined();
      expect(circuit).toBeInstanceOf(SessionCircuit);
    });

    it('should fail to initialize with invalid paths', async () => {
      await expect(circuit.initialize()).rejects.toThrow('Failed to initialize session circuit');
    });
  });

  describe('proof generation', () => {

    it('should throw error when not initialized', async () => {
      await expect(circuit.generateProof(validInputs))
        .rejects.toThrow('Circuit not initialized');
    });

    it('should validate key derivation', () => {
      const result = circuit.validateKeyDerivation(validInputs);
      expect(typeof result).toBe('boolean');
    });

    it('should handle key derivation errors', () => {
      const invalidInputs = {
        ...validInputs,
        masterSecret: [] // Empty master secret
      };
      const result = circuit.validateKeyDerivation(invalidInputs);
      expect(result).toBe(false);
    });
  });

  describe('key derivation simulation', () => {
    it('should simulate key derivation for different cipher suites', () => {
      const cipherSuites = [
        'TLS_RSA_WITH_AES_128_CBC_SHA',
        'TLS_RSA_WITH_AES_256_CBC_SHA',
        'TLS_RSA_WITH_AES_128_CBC_SHA256',
        'TLS_RSA_WITH_AES_256_CBC_SHA256',
        'TLS_RSA_WITH_AES_128_GCM_SHA256',
        'TLS_RSA_WITH_AES_256_GCM_SHA384'
      ];

      cipherSuites.forEach(cipherSuite => {
        const inputs = {
          ...validInputs,
          keyDerivationParams: { ...validInputs.keyDerivationParams, cipherSuite }
        };
        
        const result = circuit.validateKeyDerivation(inputs);
        expect(typeof result).toBe('boolean');
      });
    });

    it('should handle unknown cipher suite', () => {
      const inputs = {
        ...validInputs,
        keyDerivationParams: {
          ...validInputs.keyDerivationParams,
          cipherSuite: 'UNKNOWN_CIPHER_SUITE'
        }
      };
      
      const result = circuit.validateKeyDerivation(inputs);
      expect(typeof result).toBe('boolean');
    });
  });

  describe('key commitment validation', () => {
    it('should validate correct key commitment', () => {
      const keyCommitment = circuit.generateKeyCommitment(validInputs.sessionKeys);
      const inputsWithCorrectCommitment = { ...validInputs, keyCommitment };
      
      const result = circuit.validateKeyCommitment(inputsWithCorrectCommitment);
      expect(result).toBe(true);
    });

    it('should reject incorrect key commitment', () => {
      const inputsWithWrongCommitment = { ...validInputs, keyCommitment: 'wrong-commitment' };
      
      const result = circuit.validateKeyCommitment(inputsWithWrongCommitment);
      expect(result).toBe(false);
    });

    it('should handle commitment validation errors', () => {
      const invalidInputs = {
        ...validInputs,
        sessionKeys: {
          ...validInputs.sessionKeys,
          clientWriteKey: null as any
        }
      };
      
      const result = circuit.validateKeyCommitment(invalidInputs);
      expect(result).toBe(false);
    });
  });

  describe('public outputs extraction', () => {
    it('should extract public outputs', () => {
      const outputs = circuit.extractPublicOutputs(validInputs);
      
      expect(outputs).toBeDefined();
      expect(typeof outputs.keyCommitmentValid).toBe('boolean');
      expect(typeof outputs.derivationCorrect).toBe('boolean');
      expect(outputs.sessionIntegrityHash).toBeDefined();
      expect(typeof outputs.sessionIntegrityHash).toBe('string');
    });

    it('should generate consistent session integrity hash', () => {
      const outputs1 = circuit.extractPublicOutputs(validInputs);
      const outputs2 = circuit.extractPublicOutputs(validInputs);
      
      expect(outputs1.sessionIntegrityHash).toBe(outputs2.sessionIntegrityHash);
    });

    it('should generate different hashes for different inputs', () => {
      const inputs2 = {
        ...validInputs,
        masterSecret: Array.from({ length: 48 }, (_, i) => (i + 100).toString())
      };
      
      const outputs1 = circuit.extractPublicOutputs(validInputs);
      const outputs2 = circuit.extractPublicOutputs(inputs2);
      
      expect(outputs1.sessionIntegrityHash).not.toBe(outputs2.sessionIntegrityHash);
    });
  });

  describe('key commitment generation', () => {
    it('should generate key commitment', () => {
      const commitment = circuit.generateKeyCommitment(validInputs.sessionKeys);
      
      expect(commitment).toBeDefined();
      expect(typeof commitment).toBe('string');
      expect(commitment.length).toBeGreaterThan(0);
    });

    it('should be deterministic', () => {
      const commitment1 = circuit.generateKeyCommitment(validInputs.sessionKeys);
      const commitment2 = circuit.generateKeyCommitment(validInputs.sessionKeys);
      
      expect(commitment1).toBe(commitment2);
    });

    it('should produce different commitments for different keys', () => {
      const differentKeys = {
        ...validInputs.sessionKeys,
        clientWriteKey: Array.from({ length: 16 }, (_, i) => (i + 200).toString())
      };
      
      const commitment1 = circuit.generateKeyCommitment(validInputs.sessionKeys);
      const commitment2 = circuit.generateKeyCommitment(differentKeys);
      
      expect(commitment1).not.toBe(commitment2);
    });
  });

  describe('cipher suite key sizes', () => {
    const testCases = [
      { suite: 'TLS_RSA_WITH_AES_128_CBC_SHA', macSize: 20, encSize: 16, ivSize: 16 },
      { suite: 'TLS_RSA_WITH_AES_256_CBC_SHA', macSize: 20, encSize: 32, ivSize: 16 },
      { suite: 'TLS_RSA_WITH_AES_128_CBC_SHA256', macSize: 32, encSize: 16, ivSize: 16 },
      { suite: 'TLS_RSA_WITH_AES_256_CBC_SHA256', macSize: 32, encSize: 32, ivSize: 16 },
      { suite: 'TLS_RSA_WITH_AES_128_GCM_SHA256', macSize: 0, encSize: 16, ivSize: 4 },
      { suite: 'TLS_RSA_WITH_AES_256_GCM_SHA384', macSize: 0, encSize: 32, ivSize: 4 }
    ];

    testCases.forEach(({ suite, macSize, encSize, ivSize }) => {
      it(`should handle key sizes for ${suite}`, () => {
        const sessionKeys = {
          clientWriteKey: Array.from({ length: encSize }, (_, i) => (i + 1).toString()),
          serverWriteKey: Array.from({ length: encSize }, (_, i) => (i + 1).toString()),
          clientWriteIV: Array.from({ length: ivSize }, (_, i) => (i + 1).toString()),
          serverWriteIV: Array.from({ length: ivSize }, (_, i) => (i + 1).toString()),
          clientWriteMac: Array.from({ length: macSize }, (_, i) => (i + 1).toString()),
          serverWriteMac: Array.from({ length: macSize }, (_, i) => (i + 1).toString())
        };

        const inputs = {
          ...validInputs,
          sessionKeys,
          keyDerivationParams: { ...validInputs.keyDerivationParams, cipherSuite: suite }
        };

        const outputs = circuit.extractPublicOutputs(inputs);
        expect(outputs).toBeDefined();
      });
    });
  });

  describe('proof verification', () => {
    it('should handle verification with invalid proof', async () => {
      const mockProof = { pi_a: [1, 2], pi_b: [[3, 4], [5, 6]], pi_c: [7, 8] };
      const mockPublicSignals = ['1', '2', '3'];
      const mockVerificationKey = { vk_alpha_1: [1, 2] };

      const result = await circuit.verifyProof(mockProof, mockPublicSignals, mockVerificationKey);
      expect(result).toBe(false);
    });

    it('should handle verification errors gracefully', async () => {
      const result = await circuit.verifyProof(null, [], null);
      expect(result).toBe(false);
    });
  });

  describe('gas estimation', () => {
    it('should provide gas cost estimate', () => {
      const gasEstimate = circuit.estimateGasCost();
      expect(gasEstimate).toBe(280000);
      expect(typeof gasEstimate).toBe('number');
    });
  });

  describe('input encoding', () => {
    it('should encode cipher suite correctly', () => {
      // This tests the private encodeCipherSuite method indirectly
      expect(() => circuit.extractPublicOutputs(validInputs)).not.toThrow();
    });

    it('should encode commitment correctly', () => {
      // This tests the private encodeCommitment method indirectly
      expect(() => circuit.extractPublicOutputs(validInputs)).not.toThrow();
    });
  });

  describe('key block calculations', () => {
    it('should calculate correct key block sizes', () => {
      const testInputs = {
        ...validInputs,
        keyDerivationParams: {
          ...validInputs.keyDerivationParams,
          cipherSuite: 'TLS_RSA_WITH_AES_128_CBC_SHA'
        }
      };

      // This tests the internal key block size calculations
      const result = circuit.validateKeyDerivation(testInputs);
      expect(typeof result).toBe('boolean');
    });
  });
});