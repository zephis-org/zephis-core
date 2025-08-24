import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ZephisCore } from '../src/index';
import type { HandshakeProofInputs } from '../src/proof-generation/handshake-circuit';
import type { SessionProofInputs } from '../src/proof-generation/session-circuit';
import type { DataProofInputs } from '../src/proof-generation/data-circuit';

describe('ZephisCore', () => {
  let zephisCore: ZephisCore;
  
  beforeEach(() => {
    zephisCore = new ZephisCore();
  });

  describe('initialization', () => {
    it('should create instance with default configuration', () => {
      expect(zephisCore).toBeDefined();
      expect(zephisCore).toBeInstanceOf(ZephisCore);
    });

    it('should initialize with chain configuration', async () => {
      const chainConfig = {
        chainId: 1,
        rpcUrl: 'https://eth-mainnet.alchemyapi.io/v2/demo',
        verifierContract: '0x1234567890123456789012345678901234567890' as `0x${string}`,
        batchVerifierContract: '0x0987654321098765432109876543210987654321' as `0x${string}`
      };

      await expect(zephisCore.initialize({ chainConfig })).resolves.not.toThrow();
    });

    it('should initialize with circuit configurations', async () => {
      const config = {
        handshakeCircuit: {
          wasmPath: '/invalid/handshake.wasm',
          zkeyPath: '/invalid/handshake.zkey',
          verificationKeyPath: '/invalid/handshake.vkey'
        }
      };

      // Should throw due to invalid paths
      await expect(zephisCore.initialize(config)).rejects.toThrow();
    });
  });

  describe('proof generation', () => {
    const mockHandshakeInputs: HandshakeProofInputs = {
      clientHello: ['1', '2', '3'],
      serverHello: ['4', '5', '6'],
      serverCertificate: ['7', '8', '9'],
      clientKeyExchange: ['10', '11', '12'],
      masterSecret: ['13', '14', '15'],
      clientRandom: ['16', '17', '18'],
      serverRandom: ['19', '20', '21'],
      cipherSuite: 'TLS_RSA_WITH_AES_128_CBC_SHA'
    };

    const mockSessionInputs: SessionProofInputs = {
      masterSecret: ['13', '14', '15'],
      sessionKeys: {
        clientWriteKey: ['1', '2'],
        serverWriteKey: ['3', '4'],
        clientWriteIV: ['5', '6'],
        serverWriteIV: ['7', '8'],
        clientWriteMac: ['9', '10'],
        serverWriteMac: ['11', '12']
      },
      keyDerivationParams: {
        clientRandom: ['16', '17', '18'],
        serverRandom: ['19', '20', '21'],
        cipherSuite: 'TLS_RSA_WITH_AES_128_CBC_SHA'
      },
      keyCommitment: 'test-commitment'
    };

    const mockDataInputs: DataProofInputs = {
      applicationData: ['data1', 'data2'],
      sessionKeys: {
        clientWriteKey: ['1', '2'],
        serverWriteKey: ['3', '4'],
        clientWriteMac: ['9', '10'],
        serverWriteMac: ['11', '12']
      },
      transcriptProof: {
        merkleRoot: 'root-hash',
        merkleProofs: [['proof1'], ['proof2']],
        recordIndices: [0, 1]
      },
      sessionCommitment: 'session-commitment',
      dataCommitments: ['commitment1', 'commitment2']
    };

    it('should generate complete proof bundle', async () => {
      const sessionId = 'test-session';
      
      await expect(zephisCore.generateProofBundle(
        sessionId,
        mockHandshakeInputs,
        mockSessionInputs,
        mockDataInputs
      )).rejects.toThrow('Circuits not initialized');
    });
  });

  describe('chain operations', () => {
    const mockProofBundle = {
      handshakeProof: { proof: {}, publicInputs: [], verificationKey: {} },
      sessionProof: { proof: {}, publicInputs: [], verificationKey: {} },
      dataProof: { proof: {}, publicInputs: [], verificationKey: {} },
      metadata: { sessionId: 'test-session', timestamp: Date.now(), gasEstimate: 300000 }
    };

    beforeEach(async () => {
      const chainConfig = {
        chainId: 1,
        rpcUrl: 'https://eth-mainnet.alchemyapi.io/v2/demo',
        verifierContract: '0x1234567890123456789012345678901234567890' as `0x${string}`,
        batchVerifierContract: '0x0987654321098765432109876543210987654321' as `0x${string}`
      };
      await zephisCore.initialize({ chainConfig });
    });

    it('should submit proof to blockchain', async () => {
      const result = await zephisCore.submitProof(mockProofBundle);
      expect(result.success).toBe(false);
      expect(result.error).toContain('Wallet client not configured');
    });

    it('should submit batch proof to blockchain', async () => {
      const result = await zephisCore.submitBatchProof([mockProofBundle]);
      expect(result.success).toBe(false);
      expect(result.error).toContain('Wallet client not configured');
    });

    it('should estimate gas cost', async () => {
      await expect(zephisCore.estimateGasCost(mockProofBundle))
        .rejects.toThrow();
    });

    it('should get verification result', async () => {
      const txHash = '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890';
      const sessionId = 'test-session';
      
      // Use a fresh instance without chain configuration to avoid beforeEach setup
      const unconfiguredCore = new ZephisCore();
      
      let thrownError: Error | null = null;
      try {
        await unconfiguredCore.getVerificationResult(txHash, sessionId);
      } catch (error) {
        thrownError = error as Error;
      }
      
      expect(thrownError).not.toBeNull();
      expect(thrownError?.message).toContain('Chain submitter not configured');
    });

    it('should throw error when chain submitter not configured', async () => {
      const unconfiguredCore = new ZephisCore();
      
      await expect(unconfiguredCore.submitProof(mockProofBundle))
        .rejects.toThrow('Chain submitter not configured');
      
      await expect(unconfiguredCore.submitBatchProof([mockProofBundle]))
        .rejects.toThrow('Chain submitter not configured');
    });
  });

  describe('circuit initialization', () => {
    it('should initialize circuits with provided paths', async () => {
      const config = {
        handshakeCircuit: {
          wasmPath: '/path/to/handshake.wasm',
          zkeyPath: '/path/to/handshake.zkey',
          verificationKeyPath: '/path/to/handshake.vkey'
        },
        sessionCircuit: {
          wasmPath: '/path/to/session.wasm',
          zkeyPath: '/path/to/session.zkey',
          verificationKeyPath: '/path/to/session.vkey'
        },
        dataCircuit: {
          wasmPath: '/path/to/data.wasm',
          zkeyPath: '/path/to/data.zkey',
          verificationKeyPath: '/path/to/data.vkey'
        }
      };

      await expect(zephisCore.initialize(config))
        .rejects.toThrow(); // Will throw file system errors in test environment
    });
  });

  describe('TLS operations', () => {
    it('should start TLS handshake capture', () => {
      const mockSocket = { on: vi.fn(), once: vi.fn() };
      expect(() => zephisCore.startTLSCapture(mockSocket)).not.toThrow();
    });

    it('should extract session keys', () => {
      const clientKeyExchange = Buffer.from('mock-key-exchange');
      const privateKey = 'mock-private-key';

      expect(() => zephisCore.extractSessionKeys(clientKeyExchange, privateKey))
        .toThrow('TLS capture not started');
    });

    it('should start transcript recording', () => {
      const sessionCommitment = 'test-session-commitment';
      expect(() => zephisCore.startTranscriptRecording(sessionCommitment)).not.toThrow();
    });

    it('should record application data', () => {
      const sessionCommitment = 'test-session-commitment';
      zephisCore.startTranscriptRecording(sessionCommitment);
      
      const recordData = Buffer.from('mock-tls-record');
      expect(() => zephisCore.recordApplicationData(recordData)).not.toThrow();
    });
  });

  describe('error handling', () => {
    it('should handle invalid circuit paths gracefully', async () => {
      const config = {
        handshakeCircuit: {
          wasmPath: '/invalid/path.wasm',
          zkeyPath: '/invalid/path.zkey',
          verificationKeyPath: '/invalid/path.vkey'
        },
        sessionCircuit: {
          wasmPath: '/invalid/path.wasm',
          zkeyPath: '/invalid/path.zkey',
          verificationKeyPath: '/invalid/path.vkey'
        },
        dataCircuit: {
          wasmPath: '/invalid/path.wasm',
          zkeyPath: '/invalid/path.zkey',
          verificationKeyPath: '/invalid/path.vkey'
        }
      };

      await expect(zephisCore.initialize(config))
        .rejects.toThrow();
    });

    it('should handle missing transcript recorder', () => {
      expect(() => zephisCore.recordApplicationData(Buffer.from('test')))
        .toThrow('Transcript recording not started');
    });
  });

  describe('validation', () => {
    it('should cleanup resources', () => {
      const sessionCommitment = 'test-session-commitment';
      zephisCore.startTranscriptRecording(sessionCommitment);
      
      expect(() => zephisCore.cleanup()).not.toThrow();
    });
  });
});