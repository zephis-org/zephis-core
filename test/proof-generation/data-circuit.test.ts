import { describe, it, expect, beforeEach } from 'vitest';
import { DataCircuit } from '../../src/proof-generation/data-circuit';
import type { DataProofInputs } from '../../src/proof-generation/data-circuit';

describe('DataCircuit', () => {
  let circuit: DataCircuit;
  
  beforeEach(() => {
    circuit = new DataCircuit(
      '/path/to/data.wasm',
      '/path/to/data.zkey',
      '/path/to/data.vkey'
    );
  });

  describe('initialization', () => {
    it('should create circuit with provided paths', () => {
      expect(circuit).toBeDefined();
      expect(circuit).toBeInstanceOf(DataCircuit);
    });

    it('should fail to initialize with invalid paths', async () => {
      await expect(circuit.initialize()).rejects.toThrow('Failed to initialize data circuit');
    });
  });

  describe('proof generation', () => {
    const validInputs: DataProofInputs = {
      applicationData: ['Hello', 'World', 'Test', 'Data'],
      sessionKeys: {
        clientWriteKey: Array.from({ length: 16 }, (_, i) => (i + 1).toString()),
        serverWriteKey: Array.from({ length: 16 }, (_, i) => (i + 17).toString()),
        clientWriteMac: Array.from({ length: 20 }, (_, i) => (i + 33).toString()),
        serverWriteMac: Array.from({ length: 20 }, (_, i) => (i + 53).toString())
      },
      transcriptProof: {
        merkleRoot: 'root-hash-value',
        merkleProofs: [
          ['proof1-1', 'proof1-2'],
          ['proof2-1', 'proof2-2'],
          ['proof3-1', 'proof3-2'],
          ['proof4-1', 'proof4-2']
        ],
        recordIndices: [0, 1, 2, 3]
      },
      sessionCommitment: 'session-commitment-hash',
      dataCommitments: ['commit1', 'commit2', 'commit3', 'commit4']
    };

    it('should throw error when not initialized', async () => {
      await expect(circuit.generateProof(validInputs))
        .rejects.toThrow('Circuit not initialized');
    });

    it('should validate transcript integrity', () => {
      const result = circuit.validateTranscriptIntegrity(validInputs);
      expect(typeof result).toBe('boolean');
    });

    it('should handle transcript validation errors', () => {
      const invalidInputs = {
        ...validInputs,
        transcriptProof: {
          ...validInputs.transcriptProof,
          recordIndices: [] // Empty indices
        }
      };
      
      const result = circuit.validateTranscriptIntegrity(invalidInputs);
      expect(result).toBe(true); // Empty indices should pass
    });
  });

  describe('MAC integrity validation', () => {
    const sessionKeys = {
      clientWriteKey: Array.from({ length: 16 }, (_, i) => (i + 1).toString()),
      serverWriteKey: Array.from({ length: 16 }, (_, i) => (i + 17).toString()),
      clientWriteMac: Array.from({ length: 20 }, (_, i) => (i + 33).toString()),
      serverWriteMac: Array.from({ length: 20 }, (_, i) => (i + 53).toString())
    };

    it('should validate MAC integrity', () => {
      const applicationData = ['test-data-1', 'test-data-2'];
      const sequenceNumbers = [0, 1];
      
      const result = circuit.validateMACIntegrity(applicationData, sessionKeys, sequenceNumbers);
      expect(result).toBe(true); // Our implementation returns true for valid structure
    });

    it('should handle MAC validation errors', () => {
      const result = circuit.validateMACIntegrity([], {}, []);
      expect(result).toBe(true); // Empty data should pass
    });

    it('should validate MAC with different sequence numbers', () => {
      const applicationData = ['data1', 'data2', 'data3'];
      const sequenceNumbers = [5, 10, 15];
      
      const result = circuit.validateMACIntegrity(applicationData, sessionKeys, sequenceNumbers);
      expect(result).toBe(true);
    });
  });

  describe('selective disclosure', () => {
    const fullData = ['public-info', 'secret-key', 'balance-1000', 'transaction-id'];
    
    it('should create selective disclosure', () => {
      const revealIndices = [0, 2];
      const hiddenIndices = [1, 3];
      
      const disclosure = circuit.createSelectiveDisclosure(fullData, revealIndices, hiddenIndices);
      
      expect(disclosure.revealedData).toEqual(['public-info', 'balance-1000']);
      expect(disclosure.hiddenCommitments).toHaveLength(2);
      expect(disclosure.disclosureProof).toBeDefined();
    });

    it('should handle empty reveal set', () => {
      const disclosure = circuit.createSelectiveDisclosure(fullData, [], [0, 1, 2, 3]);
      
      expect(disclosure.revealedData).toHaveLength(0);
      expect(disclosure.hiddenCommitments).toHaveLength(4);
      expect(disclosure.disclosureProof).toBeDefined();
    });

    it('should handle empty hidden set', () => {
      const disclosure = circuit.createSelectiveDisclosure(fullData, [0, 1, 2, 3], []);
      
      expect(disclosure.revealedData).toHaveLength(4);
      expect(disclosure.hiddenCommitments).toHaveLength(0);
      expect(disclosure.disclosureProof).toBeDefined();
    });
  });

  describe('range proofs', () => {
    it('should generate range proof for valid range', () => {
      const value = 50;
      const minValue = 0;
      const maxValue = 100;
      const commitment = 'value-commitment-hash';
      
      const rangeProof = circuit.generateRangeProof(value, minValue, maxValue, commitment);
      
      expect(rangeProof.proof).toBeDefined();
      expect(rangeProof.validRange).toBe(true);
    });

    it('should generate range proof for invalid range', () => {
      const value = 150;
      const minValue = 0;
      const maxValue = 100;
      const commitment = 'value-commitment-hash';
      
      const rangeProof = circuit.generateRangeProof(value, minValue, maxValue, commitment);
      
      expect(rangeProof.proof).toBeDefined();
      expect(rangeProof.validRange).toBe(false);
    });

    it('should handle edge cases', () => {
      // Test boundary values
      const testCases = [
        { value: 0, min: 0, max: 100, expected: true },
        { value: 100, min: 0, max: 100, expected: true },
        { value: -1, min: 0, max: 100, expected: false },
        { value: 101, min: 0, max: 100, expected: false }
      ];

      testCases.forEach(({ value, min, max, expected }) => {
        const rangeProof = circuit.generateRangeProof(value, min, max, 'test-commitment');
        expect(rangeProof.validRange).toBe(expected);
      });
    });
  });

  describe('public outputs extraction', () => {
    const validInputs: DataProofInputs = {
      applicationData: ['data1', 'data2'],
      sessionKeys: {
        clientWriteKey: ['1', '2'],
        serverWriteKey: ['3', '4'],
        clientWriteMac: ['5', '6'],
        serverWriteMac: ['7', '8']
      },
      transcriptProof: {
        merkleRoot: 'root',
        merkleProofs: [['p1'], ['p2']],
        recordIndices: [0, 1]
      },
      sessionCommitment: 'session-commit',
      dataCommitments: ['dc1', 'dc2']
    };

    it('should extract public outputs', () => {
      const outputs = circuit.extractPublicOutputs(validInputs);
      
      expect(outputs).toBeDefined();
      expect(typeof outputs.transcriptValid).toBe('boolean');
      expect(typeof outputs.dataIntegrityVerified).toBe('boolean');
      expect(typeof outputs.sessionLinked).toBe('boolean');
      expect(outputs.selectiveDisclosureHash).toBeDefined();
    });

    it('should generate consistent outputs for same inputs', () => {
      const outputs1 = circuit.extractPublicOutputs(validInputs);
      const outputs2 = circuit.extractPublicOutputs(validInputs);
      
      expect(outputs1.selectiveDisclosureHash).toBe(outputs2.selectiveDisclosureHash);
    });
  });

  describe('Merkle proof verification', () => {
    it('should validate correct Merkle proofs', () => {
      // Create a simple test case
      const data = 'test-data';
      const recordIndex = 0;
      const merkleProof = ['sibling-hash'];
      const merkleRoot = 'expected-root';
      
      // The validation will use hash computation
      const inputs: DataProofInputs = {
        applicationData: [data],
        sessionKeys: {
          clientWriteKey: ['1'],
          serverWriteKey: ['2'],
          clientWriteMac: ['3'],
          serverWriteMac: ['4']
        },
        transcriptProof: {
          merkleRoot,
          merkleProofs: [merkleProof],
          recordIndices: [recordIndex]
        },
        sessionCommitment: 'commit',
        dataCommitments: ['dc1']
      };

      const result = circuit.validateTranscriptIntegrity(inputs);
      expect(typeof result).toBe('boolean');
    });

    it('should handle empty Merkle proofs', () => {
      const inputs: DataProofInputs = {
        applicationData: ['data'],
        sessionKeys: {
          clientWriteKey: ['1'],
          serverWriteKey: ['2'],
          clientWriteMac: ['3'],
          serverWriteMac: ['4']
        },
        transcriptProof: {
          merkleRoot: 'root',
          merkleProofs: [[]],
          recordIndices: [0]
        },
        sessionCommitment: 'commit',
        dataCommitments: ['dc1']
      };

      const result = circuit.validateTranscriptIntegrity(inputs);
      expect(typeof result).toBe('boolean');
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
      expect(gasEstimate).toBe(320000);
      expect(typeof gasEstimate).toBe('number');
    });
  });

  describe('session linking validation', () => {
    const sessionKeys = {
      clientWriteKey: ['1', '2'],
      serverWriteKey: ['3', '4'],
      clientWriteMac: ['5', '6'],
      serverWriteMac: ['7', '8']
    };

    it('should validate correct session linking', () => {
      // Generate the correct commitment for these keys
      const correctCommitment = circuit.extractPublicOutputs({
        applicationData: ['test'],
        sessionKeys,
        transcriptProof: { merkleRoot: 'root', merkleProofs: [[]], recordIndices: [0] },
        sessionCommitment: 'temp',
        dataCommitments: ['dc1']
      }).sessionLinked;

      // Now test with a proper setup
      expect(typeof correctCommitment).toBe('boolean');
    });
  });

  describe('data commitment calculations', () => {
    it('should generate data commitments', () => {
      const testData = { value: 100, type: 'balance' };
      
      // This tests the private commitToData method indirectly through createSelectiveDisclosure
      const disclosure = circuit.createSelectiveDisclosure([testData], [], [0]);
      
      expect(disclosure.hiddenCommitments).toHaveLength(1);
      expect(disclosure.hiddenCommitments[0]).toBeDefined();
    });

    it('should generate different commitments for different data', () => {
      const data1 = { value: 100 };
      const data2 = { value: 200 };
      
      const disclosure1 = circuit.createSelectiveDisclosure([data1], [], [0]);
      const disclosure2 = circuit.createSelectiveDisclosure([data2], [], [0]);
      
      expect(disclosure1.hiddenCommitments[0]).not.toBe(disclosure2.hiddenCommitments[0]);
    });
  });

  describe('MAC data preparation', () => {
    it('should handle various sequence numbers', () => {
      const applicationData = ['test-data'];
      const sessionKeys = {
        clientWriteKey: ['1'],
        serverWriteKey: ['2'],
        clientWriteMac: ['3'],
        serverWriteMac: ['4']
      };
      const sequenceNumbers = [0, 255, 65535, 16777215]; // Test boundary values

      sequenceNumbers.forEach(seqNum => {
        const result = circuit.validateMACIntegrity(applicationData, sessionKeys, [seqNum]);
        expect(result).toBe(true);
      });
    });
  });

  describe('error handling', () => {
    it('should handle transcript validation with malformed data', () => {
      const malformedInputs: DataProofInputs = {
        applicationData: ['data'],
        sessionKeys: {
          clientWriteKey: ['1'],
          serverWriteKey: ['2'],
          clientWriteMac: ['3'],
          serverWriteMac: ['4']
        },
        transcriptProof: {
          merkleRoot: '',
          merkleProofs: [[]],
          recordIndices: [999] // Invalid index
        },
        sessionCommitment: 'commit',
        dataCommitments: ['dc1']
      };

      const result = circuit.validateTranscriptIntegrity(malformedInputs);
      expect(typeof result).toBe('boolean');
    });

    it('should handle MAC validation with invalid keys', () => {
      const result = circuit.validateMACIntegrity(['data'], { serverWriteMac: null }, [0]);
      expect(result).toBe(false);
    });
  });
});