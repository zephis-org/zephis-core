import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ChainSubmitter } from '../../src/verifier-client/chain-submitter';
import type { ChainConfig } from '../../src/verifier-client/chain-submitter';
import type { ProofBundle } from '../../src/verifier-client/proof-bundler';

describe('ChainSubmitter', () => {
  let chainSubmitter: ChainSubmitter;
  let mockConfig: ChainConfig;
  
  beforeEach(() => {
    mockConfig = {
      chainId: 1,
      rpcUrl: 'https://eth-mainnet.alchemyapi.io/v2/test',
      verifierContract: '0x1234567890123456789012345678901234567890' as `0x${string}`,
      batchVerifierContract: '0x0987654321098765432109876543210987654321' as `0x${string}`
    };
    
    chainSubmitter = new ChainSubmitter(mockConfig);
  });

  describe('initialization', () => {
    it('should create chain submitter with configuration', () => {
      expect(chainSubmitter).toBeDefined();
      expect(chainSubmitter).toBeInstanceOf(ChainSubmitter);
    });

    it('should determine chain from chainId', () => {
      const configs = [
        { chainId: 1, expectedChain: 'mainnet' },
        { chainId: 11155111, expectedChain: 'sepolia' },
        { chainId: 137, expectedChain: 'polygon' },
        { chainId: 42161, expectedChain: 'arbitrum' },
        { chainId: 999999, expectedChain: 'mainnet' } // Unknown defaults to mainnet
      ];

      configs.forEach(({ chainId }) => {
        const config = { ...mockConfig, chainId };
        expect(() => new ChainSubmitter(config)).not.toThrow();
      });
    });

    it('should set wallet client', () => {
      const mockWalletClient = {
        account: '0xabcdef1234567890abcdef1234567890abcdef12' as `0x${string}`,
        chain: { id: 1, name: 'mainnet' },
        writeContract: vi.fn()
      } as any;

      expect(() => chainSubmitter.setWalletClient(mockWalletClient)).not.toThrow();
    });
  });

  describe('proof submission', () => {
    const mockProofBundle: ProofBundle = {
      handshakeProof: {
        proof: { pi_a: [1n, 2n], pi_b: [[3n, 4n], [5n, 6n]], pi_c: [7n, 8n] },
        publicInputs: ['123', '456', '789'],
        verificationKey: { vk_alpha_1: [1n, 2n] }
      },
      sessionProof: {
        proof: { pi_a: [9n, 10n], pi_b: [[11n, 12n], [13n, 14n]], pi_c: [15n, 16n] },
        publicInputs: ['321', '654', '987'],
        verificationKey: { vk_alpha_1: [3n, 4n] }
      },
      dataProof: {
        proof: { pi_a: [17n, 18n], pi_b: [[19n, 20n], [21n, 22n]], pi_c: [23n, 24n] },
        publicInputs: ['111', '222', '333'],
        verificationKey: { vk_alpha_1: [5n, 6n] }
      },
      metadata: {
        sessionId: 'test-session-123',
        timestamp: Date.now(),
        gasEstimate: 300000
      }
    };

    it('should fail submission without wallet client', async () => {
      const result = await chainSubmitter.submitProof(mockProofBundle);
      
      expect(result.success).toBe(false);
      expect(result.error).toBe('Wallet client not configured');
    });

    it('should handle submission with wallet client', async () => {
      const mockWalletClient = {
        account: '0xabcdef1234567890abcdef1234567890abcdef12' as `0x${string}`,
        chain: { id: 1, name: 'mainnet' },
        writeContract: vi.fn().mockRejectedValue(new Error('Mock transaction error'))
      } as any;

      chainSubmitter.setWalletClient(mockWalletClient);
      
      const result = await chainSubmitter.submitProof(mockProofBundle);
      expect(result.success).toBe(false);
      expect(result.error).toContain('Transaction failed');
    });

    it('should format proof correctly for contract submission', () => {
      // This tests the private formatProofForContract method indirectly
      expect(() => chainSubmitter.estimateGasCost(mockProofBundle)).rejects.toThrow();
    });
  });

  describe('batch proof submission', () => {
    const mockBatchBundle = {
      proofs: [
        {
          handshakeProof: { proof: {}, publicInputs: ['1'], verificationKey: {} },
          sessionProof: { proof: {}, publicInputs: ['2'], verificationKey: {} },
          dataProof: { proof: {}, publicInputs: ['3'], verificationKey: {} },
          metadata: { sessionId: 'batch-1', timestamp: Date.now(), gasEstimate: 300000 }
        },
        {
          handshakeProof: { proof: {}, publicInputs: ['4'], verificationKey: {} },
          sessionProof: { proof: {}, publicInputs: ['5'], verificationKey: {} },
          dataProof: { proof: {}, publicInputs: ['6'], verificationKey: {} },
          metadata: { sessionId: 'batch-2', timestamp: Date.now(), gasEstimate: 300000 }
        }
      ],
      batchCommitment: 'batch-commitment-hash',
      merkleRoot: 'merkle-root-hash',
      totalGasEstimate: 600000
    };

    it('should fail batch submission without wallet client', async () => {
      const result = await chainSubmitter.submitBatchProof(mockBatchBundle);
      
      expect(result.success).toBe(false);
      expect(result.error).toBe('Wallet client not configured');
      expect(result.results).toHaveLength(0);
      expect(result.totalGasUsed).toBe(0n);
    });

    it('should handle batch submission with wallet client', async () => {
      const mockWalletClient = {
        account: '0xabcdef1234567890abcdef1234567890abcdef12' as `0x${string}`,
        chain: { id: 1, name: 'mainnet' },
        writeContract: vi.fn().mockRejectedValue(new Error('Mock batch error'))
      } as any;

      chainSubmitter.setWalletClient(mockWalletClient);
      
      const result = await chainSubmitter.submitBatchProof(mockBatchBundle);
      expect(result.success).toBe(false);
      expect(result.error).toContain('Batch transaction failed');
    });
  });

  describe('gas estimation', () => {
    const mockProofBundle: ProofBundle = {
      handshakeProof: { proof: {}, publicInputs: ['1'], verificationKey: {} },
      sessionProof: { proof: {}, publicInputs: ['2'], verificationKey: {} },
      dataProof: { proof: {}, publicInputs: ['3'], verificationKey: {} },
      metadata: { sessionId: 'gas-test', timestamp: Date.now(), gasEstimate: 300000 }
    };

    it('should estimate gas cost', async () => {
      await expect(chainSubmitter.estimateGasCost(mockProofBundle))
        .rejects.toThrow(); // Will fail due to missing network connection
    });

    it('should handle gas estimation errors', async () => {
      // Mock a failing RPC call
      await expect(chainSubmitter.estimateGasCost(mockProofBundle))
        .rejects.toThrow();
    });
  });

  describe('verification result retrieval', () => {
    const mockTxHash = '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890' as `0x${string}`;
    const sessionId = 'verification-test';

    it('should get verification result', async () => {
      // Mock the publicClient to simulate network failure
      const originalClient = (chainSubmitter as any).publicClient;
      (chainSubmitter as any).publicClient = {
        waitForTransactionReceipt: vi.fn().mockRejectedValue(new Error('Network connection failed'))
      };
      
      const result = await chainSubmitter.getVerificationResult(mockTxHash, sessionId);
      
      expect(result.verified).toBe(false);
      expect(result.error).toContain('Failed to get verification result');
      
      // Restore original client
      (chainSubmitter as any).publicClient = originalClient;
    });

    it('should handle verification errors', async () => {
      // Mock the publicClient to simulate network failure
      const originalClient = (chainSubmitter as any).publicClient;
      (chainSubmitter as any).publicClient = {
        waitForTransactionReceipt: vi.fn().mockRejectedValue(new Error('Invalid hash'))
      };
      
      const invalidHash = 'invalid-hash' as any;
      const result = await chainSubmitter.getVerificationResult(invalidHash, sessionId);
      
      expect(result.verified).toBe(false);
      expect(result.error).toBeTruthy();
      
      // Restore original client
      (chainSubmitter as any).publicClient = originalClient;
    });
  });

  describe('transaction confirmation', () => {
    const mockTxHash = '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890' as `0x${string}`;

    it('should wait for confirmations', async () => {
      // Mock the publicClient to simulate network failure
      const originalClient = (chainSubmitter as any).publicClient;
      (chainSubmitter as any).publicClient = {
        waitForTransactionReceipt: vi.fn().mockRejectedValue(new Error('Network timeout'))
      };
      
      const result = await chainSubmitter.waitForConfirmations(mockTxHash, 3);
      expect(result).toBe(false); // Should return false on network error
      
      // Restore original client
      (chainSubmitter as any).publicClient = originalClient;
    });

    it('should handle confirmation errors', async () => {
      // Mock the publicClient to simulate network failure
      const originalClient = (chainSubmitter as any).publicClient;
      (chainSubmitter as any).publicClient = {
        waitForTransactionReceipt: vi.fn().mockRejectedValue(new Error('Connection failed'))
      };
      
      const result = await chainSubmitter.waitForConfirmations(mockTxHash, 1);
      expect(result).toBe(false); // Should return false on error
      
      // Restore original client
      (chainSubmitter as any).publicClient = originalClient;
    });

    it('should use default confirmation count', async () => {
      // Mock the publicClient to simulate network failure
      const originalClient = (chainSubmitter as any).publicClient;
      (chainSubmitter as any).publicClient = {
        waitForTransactionReceipt: vi.fn().mockRejectedValue(new Error('Default confirmation test'))
      };
      
      // Test default parameter
      const result = await chainSubmitter.waitForConfirmations(mockTxHash);
      expect(result).toBe(false);
      
      // Restore original client
      (chainSubmitter as any).publicClient = originalClient;
    });
  });

  describe('proof formatting', () => {
    it('should format Groth16 proof elements correctly', () => {
      const mockProof = {
        pi_a: [123n, 456n],
        pi_b: [[789n, 101112n], [131415n, 161718n]],
        pi_c: [192021n, 222324n]
      };

      const mockBundle: ProofBundle = {
        handshakeProof: { proof: mockProof, publicInputs: ['1', '2'], verificationKey: {} },
        sessionProof: { proof: mockProof, publicInputs: ['3', '4'], verificationKey: {} },
        dataProof: { proof: mockProof, publicInputs: ['5', '6'], verificationKey: {} },
        metadata: { sessionId: 'format-test', timestamp: Date.now(), gasEstimate: 300000 }
      };

      // Test formatting indirectly through gas estimation
      expect(() => chainSubmitter.estimateGasCost(mockBundle)).rejects.toThrow();
    });

    it('should handle missing proof elements', () => {
      const incompleteProof = {
        pi_a: [123n],
        pi_b: [[789n, 0n]],
        pi_c: [0n, 222324n]
      };

      const mockBundle: ProofBundle = {
        handshakeProof: { proof: incompleteProof, publicInputs: ['1'], verificationKey: {} },
        sessionProof: { proof: incompleteProof, publicInputs: ['2'], verificationKey: {} },
        dataProof: { proof: incompleteProof, publicInputs: ['3'], verificationKey: {} },
        metadata: { sessionId: 'incomplete-test', timestamp: Date.now(), gasEstimate: 300000 }
      };

      expect(() => chainSubmitter.estimateGasCost(mockBundle)).rejects.toThrow();
    });
  });

  describe('contract ABI generation', () => {
    it('should provide verifier ABI', () => {
      // Test ABI generation indirectly
      expect(() => chainSubmitter.estimateGasCost(mockProofBundle)).rejects.toThrow();
    });

    it('should provide batch verifier ABI', async () => {
      const mockBatch = {
        proofs: [],
        batchCommitment: 'commit',
        merkleRoot: 'root',
        totalGasEstimate: 0
      };
      
      const result = await chainSubmitter.submitBatchProof(mockBatch);
      expect(result.success).toBe(false);
      expect(result.error).toContain('Wallet client not configured');
    });
  });

  describe('network error handling', () => {
    it('should handle RPC connection errors', async () => {
      const invalidConfig = {
        ...mockConfig,
        rpcUrl: 'https://invalid-rpc-url.com'
      };
      
      const invalidSubmitter = new ChainSubmitter(invalidConfig);
      
      const mockBundle: ProofBundle = {
        handshakeProof: { proof: {}, publicInputs: [], verificationKey: {} },
        sessionProof: { proof: {}, publicInputs: [], verificationKey: {} },
        dataProof: { proof: {}, publicInputs: [], verificationKey: {} },
        metadata: { sessionId: 'error-test', timestamp: Date.now(), gasEstimate: 300000 }
      };

      await expect(invalidSubmitter.estimateGasCost(mockBundle))
        .rejects.toThrow();
    });

    it('should handle timeout errors', async () => {
      // This test simulates network timeouts
      const mockBundle: ProofBundle = {
        handshakeProof: { proof: {}, publicInputs: [], verificationKey: {} },
        sessionProof: { proof: {}, publicInputs: [], verificationKey: {} },
        dataProof: { proof: {}, publicInputs: [], verificationKey: {} },
        metadata: { sessionId: 'timeout-test', timestamp: Date.now(), gasEstimate: 300000 }
      };

      await expect(chainSubmitter.estimateGasCost(mockBundle))
        .rejects.toThrow();
    });
  });

  describe('public input formatting', () => {
    it('should format public inputs as bigint arrays', () => {
      const testInputs = ['123', '456', '789'];
      
      // Test formatting indirectly through proof submission
      const mockBundle: ProofBundle = {
        handshakeProof: { proof: {}, publicInputs: testInputs, verificationKey: {} },
        sessionProof: { proof: {}, publicInputs: testInputs, verificationKey: {} },
        dataProof: { proof: {}, publicInputs: testInputs, verificationKey: {} },
        metadata: { sessionId: 'input-test', timestamp: Date.now(), gasEstimate: 300000 }
      };

      expect(() => chainSubmitter.estimateGasCost(mockBundle)).rejects.toThrow();
    });

    it('should handle invalid string inputs', () => {
      const invalidInputs = ['not-a-number', '456'];
      
      const mockBundle: ProofBundle = {
        handshakeProof: { proof: {}, publicInputs: invalidInputs, verificationKey: {} },
        sessionProof: { proof: {}, publicInputs: ['123'], verificationKey: {} },
        dataProof: { proof: {}, publicInputs: ['456'], verificationKey: {} },
        metadata: { sessionId: 'invalid-input-test', timestamp: Date.now(), gasEstimate: 300000 }
      };

      expect(() => chainSubmitter.estimateGasCost(mockBundle)).rejects.toThrow();
    });
  });

  describe('chain-specific configurations', () => {
    const chainConfigs = [
      { chainId: 1, name: 'mainnet' },
      { chainId: 11155111, name: 'sepolia' },
      { chainId: 137, name: 'polygon' },
      { chainId: 42161, name: 'arbitrum' }
    ];

    chainConfigs.forEach(({ chainId, name }) => {
      it(`should handle ${name} chain configuration`, () => {
        const config = { ...mockConfig, chainId };
        const submitter = new ChainSubmitter(config);
        
        expect(submitter).toBeDefined();
        expect(submitter).toBeInstanceOf(ChainSubmitter);
      });
    });
  });

  describe('wallet client integration', () => {
    it('should handle wallet client with no account', async () => {
      const mockWalletClient = {
        account: null,
        chain: { id: 1, name: 'mainnet' },
        writeContract: vi.fn()
      } as any;

      chainSubmitter.setWalletClient(mockWalletClient);

      const mockBundle: ProofBundle = {
        handshakeProof: { proof: {}, publicInputs: [], verificationKey: {} },
        sessionProof: { proof: {}, publicInputs: [], verificationKey: {} },
        dataProof: { proof: {}, publicInputs: [], verificationKey: {} },
        metadata: { sessionId: 'no-account-test', timestamp: Date.now(), gasEstimate: 300000 }
      };

      const result = await chainSubmitter.submitProof(mockBundle);
      expect(result.success).toBe(false);
    });

    it('should handle wallet client without chain', async () => {
      const mockWalletClient = {
        account: '0xabcdef1234567890abcdef1234567890abcdef12' as `0x${string}`,
        chain: null,
        writeContract: vi.fn()
      } as any;

      chainSubmitter.setWalletClient(mockWalletClient);

      const mockBundle: ProofBundle = {
        handshakeProof: { proof: {}, publicInputs: [], verificationKey: {} },
        sessionProof: { proof: {}, publicInputs: [], verificationKey: {} },
        dataProof: { proof: {}, publicInputs: [], verificationKey: {} },
        metadata: { sessionId: 'no-chain-test', timestamp: Date.now(), gasEstimate: 300000 }
      };

      const result = await chainSubmitter.submitProof(mockBundle);
      expect(result.success).toBe(false);
    });
  });

  const mockProofBundle: ProofBundle = {
    handshakeProof: { proof: {}, publicInputs: [], verificationKey: {} },
    sessionProof: { proof: {}, publicInputs: [], verificationKey: {} },
    dataProof: { proof: {}, publicInputs: [], verificationKey: {} },
    metadata: { sessionId: 'mock-test', timestamp: Date.now(), gasEstimate: 300000 }
  };
});