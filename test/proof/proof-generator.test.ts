import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ProofGenerator } from '../../src/proof/proof-generator';

// Import the mocked snarkjs
const snarkjs = vi.mocked(await import('snarkjs')).default;

describe('ProofGenerator', () => {
  let proofGenerator: ProofGenerator;
  let mockExtractedData: any;
  let mockTlsData: any;
  let mockTemplate: any;

  beforeEach(() => {
    // Reset mocks
    vi.clearAllMocks();
    
    // Set default mock implementations
    snarkjs.groth16.fullProve.mockResolvedValue({
      proof: {
        pi_a: ['1', '2', '1'],
        pi_b: [['3', '4'], ['5', '6'], ['1', '0']],
        pi_c: ['7', '8', '1']
      },
      publicSignals: ['1', '0']
    });
    
    snarkjs.groth16.verify.mockResolvedValue(true);
    
    proofGenerator = new ProofGenerator();
    
    mockExtractedData = {
      raw: { balance: '$1,000.00' },
      processed: { balance: 1000 },
      timestamp: Date.now(),
      url: 'https://test.com',
      domain: 'test.com'
    };

    mockTlsData = {
      serverCertificate: 'cert-base64',
      sessionKeys: {
        clientRandom: '0x1234',
        serverRandom: '0x5678',
        masterSecret: '0x9abc'
      },
      handshakeMessages: ['0xmsg1', '0xmsg2'],
      timestamp: Date.now()
    };

    vi.spyOn(proofGenerator['circuitLoader'], 'loadWasm').mockResolvedValue(Buffer.from('wasm'));
    vi.spyOn(proofGenerator['circuitLoader'], 'loadZkey').mockResolvedValue(Buffer.from('zkey'));
    vi.spyOn(proofGenerator['circuitLoader'], 'loadVerificationKey').mockResolvedValue({
      protocol: 'groth16'
    });
    
    // Mock the template circuit mapper methods
    vi.spyOn(proofGenerator['templateCircuitMapper'], 'registerTemplate').mockImplementation(() => {});
    vi.spyOn(proofGenerator['templateCircuitMapper'], 'getCircuitConfig').mockReturnValue({
      circuitId: 'balance-greater-than',
      constraints: ['balance > 1000'],
      inputFormat: { balance: 'uint256' }
    });
    
    vi.spyOn(proofGenerator['templateCircuitMapper'], 'validateDataForCircuit').mockReturnValue({
      isValid: true,
      errors: []
    });
    
    vi.spyOn(proofGenerator['templateCircuitMapper'], 'generateCircuitInput').mockReturnValue({
      dataHash: '123',
      claimHash: '456',
      templateHash: '789',
      threshold: 1000,
      timestamp: Date.now(),
      data: [1, 2, 3],
      claim: [4, 5, 6],
      dataType: 0,
      claimType: 0,
      actualValue: 1000
    });
    
    // Mock dynamic circuit loader
    vi.spyOn(proofGenerator['dynamicCircuitLoader'], 'loadCircuitAssets').mockResolvedValue({
      wasm: Buffer.from('wasm'),
      zkey: Buffer.from('zkey'),
      verificationKey: { protocol: 'groth16' },
      circuitInfo: { name: 'balance-greater-than' }
    });
    
    // Mock circuit mapper validation
    vi.spyOn(proofGenerator['circuitMapper'], 'validateCircuitInput').mockReturnValue(true);

    mockTemplate = {
      domain: 'test.com',
      name: 'test-template',
      version: '1.0',
      selectors: {
        balance: '.balance'
      },
      extractors: {
        balance: 'text'
      }
    };
  });

  describe('generateProof', () => {
    it('should generate proof successfully', async () => {
      const proof = await proofGenerator.generateProof(
        'session-123',
        mockTemplate,
        'balanceGreaterThan',
        mockExtractedData,
        mockTlsData
      );

      expect(proof).toEqual({
        proof: {
          a: ['1', '2'],
          b: [['4', '3'], ['6', '5']],
          c: ['7', '8']
        },
        publicInputs: ['1', '0'],
        metadata: {
          sessionId: 'session-123',
          template: 'test-template',
          claim: 'balanceGreaterThan',
          timestamp: expect.any(Number),
          domain: 'test.com',
          circuitId: 'balance-greater-than'
        }
      });

      expect(snarkjs.groth16.fullProve).toHaveBeenCalledWith(
        expect.any(Object),
        expect.any(Buffer),
        expect.any(Buffer)
      );
    });

    it('should handle different claim types', async () => {
      const claims = [
        'hasMinimumBalance',
        'followersGreaterThan',
        'isInfluencer',
        'hasVerifiedBadge',
        'accountAge'
      ];

      for (const claim of claims) {
        await proofGenerator.generateProof(
          'session-123',
          mockTemplate,
          claim,
          mockExtractedData,
          mockTlsData
        );
      }

      expect(snarkjs.groth16.fullProve).toHaveBeenCalledTimes(claims.length);
    });

    it('should use generic circuit for unknown claims', async () => {
      const proof = await proofGenerator.generateProof(
        'session-123',
        mockTemplate,
        'unknownClaim',
        mockExtractedData,
        mockTlsData
      );

      expect(proof.metadata.circuitId).toBe('balance-greater-than');
    });

    it('should handle proof generation errors', async () => {
      snarkjs.groth16.fullProve.mockRejectedValue(new Error('Proof failed'));

      await expect(proofGenerator.generateProof(
        'session-123',
        mockTemplate,
        'balanceGreaterThan',
        mockExtractedData,
        mockTlsData
      )).rejects.toThrow('Proof failed');
    });
  });

  describe('verifyProof', () => {
    it('should verify valid proof', async () => {
      const mockProof = global.testUtils.generateMockProof();

      const result = await proofGenerator.verifyProof(mockProof);

      expect(result).toBe(true);
      expect(snarkjs.groth16.verify).toHaveBeenCalledWith(
        expect.objectContaining({ protocol: 'groth16' }),
        mockProof.publicInputs,
        expect.objectContaining({
          pi_a: expect.arrayContaining(['1', '2', '1']),
          protocol: 'groth16',
          curve: 'bn128'
        })
      );
    });

    it('should reject invalid proof', async () => {
      const mockProof = global.testUtils.generateMockProof();
      snarkjs.groth16.verify.mockResolvedValue(false);

      const result = await proofGenerator.verifyProof(mockProof);

      expect(result).toBe(false);
    });

    it('should handle verification errors', async () => {
      const mockProof = global.testUtils.generateMockProof();
      snarkjs.groth16.verify.mockRejectedValue(new Error('Verification error'));

      const result = await proofGenerator.verifyProof(mockProof);

      expect(result).toBe(false);
    });
  });

  describe('generateMockProof', () => {
    it('should generate mock proof', async () => {
      const proof = await proofGenerator.generateMockProof(
        'session-123',
        'test-template',
        'test-claim',
        'test.com'
      );

      expect(proof).toEqual({
        proof: {
          a: ['1', '2'],
          b: [['3', '4'], ['5', '6']],
          c: ['7', '8']
        },
        publicInputs: ['1', '0'],
        metadata: {
          sessionId: 'session-123',
          template: 'test-template',
          claim: 'test-claim',
          timestamp: expect.any(Number),
          domain: 'test.com',
          circuitId: 'mock_circuit'
        }
      });
    });
  });

  describe('batchGenerateProofs', () => {
    it('should generate multiple proofs', async () => {
      const requests = [
        {
          sessionId: 'session-1',
          template: mockTemplate,
          claim: 'claim-1',
          extractedData: mockExtractedData,
          tlsData: mockTlsData
        },
        {
          sessionId: 'session-2',
          template: mockTemplate,
          claim: 'claim-2',
          extractedData: mockExtractedData,
          tlsData: mockTlsData
        }
      ];

      const proofs = await proofGenerator.batchGenerateProofs(requests);

      expect(proofs).toHaveLength(2);
      expect(proofs[0].metadata.sessionId).toBe('session-1');
      expect(proofs[1].metadata.sessionId).toBe('session-2');
    });

    it('should handle errors in batch generation', async () => {
      snarkjs.groth16.fullProve
        .mockResolvedValueOnce({
          proof: {
            pi_a: ['1', '2', '1'],
            pi_b: [['3', '4'], ['5', '6'], ['1', '0']],
            pi_c: ['7', '8', '1']
          },
          publicSignals: ['1', '0']
        })
        .mockRejectedValueOnce(new Error('Proof failed'));

      const requests = [
        {
          sessionId: 'session-1',
          template: mockTemplate,
          claim: 'claim-1',
          extractedData: mockExtractedData,
          tlsData: mockTlsData
        },
        {
          sessionId: 'session-2',
          template: mockTemplate,
          claim: 'claim-2',
          extractedData: mockExtractedData,
          tlsData: mockTlsData
        }
      ];

      const proofs = await proofGenerator.batchGenerateProofs(requests);

      expect(proofs).toHaveLength(1);
      expect(proofs[0].metadata.sessionId).toBe('session-1');
    });
  });

  describe('exportProof/importProof', () => {
    it('should export proof to JSON string', async () => {
      const mockProof = global.testUtils.generateMockProof();
      
      const exported = await proofGenerator.exportProof(mockProof);
      
      expect(exported).toBeTypeOf('string');
      const parsed = JSON.parse(exported);
      expect(parsed.metadata.sessionId).toBe('test-session-123');
    });

    it('should import proof from JSON string', async () => {
      const mockProof = global.testUtils.generateMockProof();
      const exported = JSON.stringify(mockProof);
      
      const imported = await proofGenerator.importProof(exported);
      
      expect(imported).toEqual(mockProof);
    });

    it('should throw error for invalid proof data', async () => {
      await expect(proofGenerator.importProof('invalid json'))
        .rejects.toThrow('Invalid proof data');
    });
  });
});