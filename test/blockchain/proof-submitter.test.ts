import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ProofSubmitter } from '../../src/blockchain/proof-submitter';
import { ContractClient } from '../../src/blockchain/contract-client';
import { ZKProof, VerificationResult } from '../../src/types';
import { WalletClient } from 'viem';
import logger from '../../src/utils/logger';

// Mock dependencies
vi.mock('../../src/blockchain/contract-client');
vi.mock('../../src/utils/logger');
// Create a global mock queue instance
const mockQueueInstance = {
  add: vi.fn().mockImplementation((fn) => fn()),
  size: 0,
  onIdle: vi.fn().mockResolvedValue(undefined),
  pause: vi.fn(),
  start: vi.fn()
};

vi.mock('p-queue', () => {
  return {
    default: vi.fn().mockImplementation(() => mockQueueInstance)
  };
});

describe('ProofSubmitter', () => {
  let proofSubmitter: ProofSubmitter;
  let mockContractClient: any;
  let mockWalletClient: Partial<WalletClient>;
  let mockLogger: any;

  const mockProof: ZKProof = {
    proof: {
      pi_a: ['0x1', '0x2', '0x3'],
      pi_b: [['0x4', '0x5'], ['0x6', '0x7']],
      pi_c: ['0x8', '0x9', '0xa'],
      protocol: 'groth16',
      curve: 'bn128'
    },
    publicSignals: ['0xabc', '0xdef'],
    metadata: {
      sessionId: 'test-session-123',
      template: 'test-template',
      claim: 'test-claim',
      timestamp: Date.now(),
      version: '1.0',
      circuitId: 'test-circuit'
    }
  };

  const mockVerificationResult: VerificationResult = {
    valid: true,
    timestamp: Date.now(),
    transactionHash: '0x123abc',
    blockNumber: 123456,
    gasUsed: 50000
  };

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Reset mock queue instance
    mockQueueInstance.add = vi.fn().mockImplementation((fn) => fn());
    mockQueueInstance.onIdle = vi.fn().mockResolvedValue(undefined);
    mockQueueInstance.pause = vi.fn();
    mockQueueInstance.start = vi.fn();

    // Setup contract client mock
    mockContractClient = {
      submitProof: vi.fn().mockResolvedValue(mockVerificationResult),
      verifyProof: vi.fn().mockResolvedValue(mockVerificationResult)
    };

    // Setup wallet client mock
    mockWalletClient = {
      account: { address: '0x123' as any },
      chain: { id: 1 } as any
    };

    // Setup logger mock
    mockLogger = {
      info: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
      debug: vi.fn()
    };

    (ContractClient as any).mockImplementation(() => mockContractClient);
    (logger as any).info = mockLogger.info;
    (logger as any).error = mockLogger.error;
    (logger as any).warn = mockLogger.warn;
    (logger as any).debug = mockLogger.debug;

    proofSubmitter = new ProofSubmitter(new ContractClient() as any);
    // Inject the mock queue into the private queue property
    (proofSubmitter as any).queue = mockQueueInstance;
  });

  afterEach(() => {
    proofSubmitter.clearHistory();
  });

  describe('Constructor', () => {
    it('should initialize with contract client and queue', () => {
      expect(proofSubmitter).toBeDefined();
      expect(proofSubmitter.getQueueSize()).toBe(0);
    });
  });

  describe('submitProof', () => {
    it('should submit proof successfully', async () => {
      const result = await proofSubmitter.submitProof(mockProof, mockWalletClient as WalletClient);

      expect(result).toEqual(mockVerificationResult);
      expect(mockContractClient.submitProof).toHaveBeenCalledWith(mockProof, mockWalletClient);
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('Submitting proof')
      );
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('successfully submitted')
      );
    });

    it('should return cached result for duplicate proof', async () => {
      // Submit proof first time
      await proofSubmitter.submitProof(mockProof, mockWalletClient as WalletClient);
      
      // Reset mock to ensure it's not called again
      mockContractClient.submitProof.mockClear();
      
      // Submit same proof again
      const result = await proofSubmitter.submitProof(mockProof, mockWalletClient as WalletClient);

      expect(result).toEqual(mockVerificationResult);
      expect(mockContractClient.submitProof).not.toHaveBeenCalled();
      expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining('already submitted'));
    });

    it('should handle submission failure', async () => {
      const error = new Error('Submission failed');
      mockContractClient.submitProof.mockRejectedValue(error);

      await expect(proofSubmitter.submitProof(mockProof, mockWalletClient as WalletClient))
        .rejects.toThrow('Submission failed');

      const history = proofSubmitter.getSubmissionHistory();
      expect(history).toHaveLength(1);
      expect(history[0].valid).toBe(false);
      expect(history[0].error).toBe('Submission failed');
    });

    it('should handle invalid proof result', async () => {
      const invalidResult = {
        valid: false,
        timestamp: Date.now(),
        error: 'Invalid proof'
      };
      mockContractClient.submitProof.mockResolvedValue(invalidResult);

      const result = await proofSubmitter.submitProof(mockProof, mockWalletClient as WalletClient);

      expect(result).toEqual(invalidResult);
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('submission failed: Invalid proof')
      );
    });

    it('should handle non-Error exceptions', async () => {
      mockContractClient.submitProof.mockRejectedValue('String error');

      await expect(proofSubmitter.submitProof(mockProof, mockWalletClient as WalletClient))
        .rejects.toBe('String error');

      const history = proofSubmitter.getSubmissionHistory();
      expect(history[0].error).toBe('Unknown error');
    });
  });

  describe('batchSubmit', () => {
    it('should submit multiple proofs successfully', async () => {
      const proofs = [
        { ...mockProof, metadata: { ...mockProof.metadata, sessionId: 'session-1' } },
        { ...mockProof, metadata: { ...mockProof.metadata, sessionId: 'session-2' } }
      ];

      const results = await proofSubmitter.batchSubmit(proofs, mockWalletClient as WalletClient);

      expect(results).toHaveLength(2);
      expect(results[0]).toEqual(mockVerificationResult);
      expect(results[1]).toEqual(mockVerificationResult);
      expect(mockContractClient.submitProof).toHaveBeenCalledTimes(2);
    });

    it('should handle mixed success and failure in batch', async () => {
      const proofs = [
        { ...mockProof, metadata: { ...mockProof.metadata, sessionId: 'session-1' } },
        { ...mockProof, metadata: { ...mockProof.metadata, sessionId: 'session-2' } }
      ];

      // First call succeeds, second fails
      mockContractClient.submitProof
        .mockResolvedValueOnce(mockVerificationResult)
        .mockRejectedValueOnce(new Error('Second proof failed'));

      const results = await proofSubmitter.batchSubmit(proofs, mockWalletClient as WalletClient);

      expect(results).toHaveLength(2);
      expect(results[0].valid).toBe(true);
      expect(results[1].valid).toBe(false);
      expect(results[1].error).toBe('Second proof failed');
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to submit proof in batch:',
        expect.any(Error)
      );
    });

    it('should handle empty batch', async () => {
      const results = await proofSubmitter.batchSubmit([], mockWalletClient as WalletClient);

      expect(results).toHaveLength(0);
      expect(mockContractClient.submitProof).not.toHaveBeenCalled();
    });
  });

  describe('verifyOnChain', () => {
    it('should verify proof on chain successfully', async () => {
      const result = await proofSubmitter.verifyOnChain(mockProof);

      expect(result).toEqual(mockVerificationResult);
      expect(mockContractClient.verifyProof).toHaveBeenCalledWith(mockProof);
    });

    it('should handle verification failure', async () => {
      const error = new Error('Verification failed');
      mockContractClient.verifyProof.mockRejectedValue(error);

      const result = await proofSubmitter.verifyOnChain(mockProof);

      expect(result.valid).toBe(false);
      expect(result.error).toBe('Verification failed');
      expect(mockLogger.error).toHaveBeenCalledWith('On-chain verification failed:', error);
    });

    it('should handle non-Error exceptions in verification', async () => {
      mockContractClient.verifyProof.mockRejectedValue('String error');

      const result = await proofSubmitter.verifyOnChain(mockProof);

      expect(result.valid).toBe(false);
      expect(result.error).toBe('Unknown error');
    });
  });

  describe('generateProofId', () => {
    it('should generate consistent proof IDs for same proof', async () => {
      // Submit same proof twice and verify we get the cached result
      const result1 = await proofSubmitter.submitProof(mockProof, mockWalletClient as WalletClient);
      mockContractClient.submitProof.mockClear();
      const result2 = await proofSubmitter.submitProof(mockProof, mockWalletClient as WalletClient);

      expect(result1).toEqual(result2);
      expect(mockContractClient.submitProof).not.toHaveBeenCalledTimes(1); // Should be called only once total
    });

    it('should generate different proof IDs for different proofs', async () => {
      const proof2 = { ...mockProof, metadata: { ...mockProof.metadata, sessionId: 'different-session' } };

      await proofSubmitter.submitProof(mockProof, mockWalletClient as WalletClient);
      await proofSubmitter.submitProof(proof2, mockWalletClient as WalletClient);

      expect(mockContractClient.submitProof).toHaveBeenCalledTimes(2);
      
      const history = proofSubmitter.getSubmissionHistory();
      expect(history).toHaveLength(2);
    });
  });

  describe('getSubmissionHistory', () => {
    it('should return empty history initially', () => {
      const history = proofSubmitter.getSubmissionHistory();
      expect(history).toHaveLength(0);
    });

    it('should return submission history', async () => {
      await proofSubmitter.submitProof(mockProof, mockWalletClient as WalletClient);

      const history = proofSubmitter.getSubmissionHistory();
      expect(history).toHaveLength(1);
      expect(history[0]).toEqual(mockVerificationResult);
    });
  });

  describe('clearHistory', () => {
    it('should clear submission history', async () => {
      await proofSubmitter.submitProof(mockProof, mockWalletClient as WalletClient);
      expect(proofSubmitter.getSubmissionHistory()).toHaveLength(1);

      proofSubmitter.clearHistory();
      expect(proofSubmitter.getSubmissionHistory()).toHaveLength(0);
    });
  });

  describe('retryFailedSubmissions', () => {
    it('should retry failed submissions', async () => {
      // Create a failed submission
      mockContractClient.submitProof.mockRejectedValueOnce(new Error('First failure'));
      
      try {
        await proofSubmitter.submitProof(mockProof, mockWalletClient as WalletClient);
      } catch {
        // Expected to fail
      }

      expect(proofSubmitter.getSubmissionHistory()).toHaveLength(1);
      expect(proofSubmitter.getSubmissionHistory()[0].valid).toBe(false);

      // Retry failed submissions
      await proofSubmitter.retryFailedSubmissions(mockWalletClient as WalletClient);

      expect(mockLogger.info).toHaveBeenCalledWith('Retrying 1 failed submissions');
      
      // History should be cleared of failed entries
      const historyAfterRetry = proofSubmitter.getSubmissionHistory();
      expect(historyAfterRetry).toHaveLength(0);
    });

    it('should handle no failed submissions', async () => {
      await proofSubmitter.submitProof(mockProof, mockWalletClient as WalletClient);

      await proofSubmitter.retryFailedSubmissions(mockWalletClient as WalletClient);

      expect(mockLogger.info).toHaveBeenCalledWith('Retrying 0 failed submissions');
    });
  });

  describe('Queue Management', () => {
    it('should report correct queue size', () => {
      const size = proofSubmitter.getQueueSize();
      expect(typeof size).toBe('number');
    });

    it('should wait for queue to be idle', async () => {
      await expect(proofSubmitter.waitForQueue()).resolves.toBeUndefined();
    });

    it('should pause and resume submissions', () => {
      expect(() => proofSubmitter.pauseSubmissions()).not.toThrow();
      expect(() => proofSubmitter.resumeSubmissions()).not.toThrow();
    });
  });

  describe('Integration Scenarios', () => {
    it('should handle rapid consecutive submissions', async () => {
      const proofs = Array.from({ length: 5 }, (_, i) => ({
        ...mockProof,
        metadata: { ...mockProof.metadata, sessionId: `session-${i}` }
      }));

      const promises = proofs.map(proof => 
        proofSubmitter.submitProof(proof, mockWalletClient as WalletClient)
      );

      const results = await Promise.all(promises);

      expect(results).toHaveLength(5);
      expect(results.every(result => result.valid)).toBe(true);
      expect(proofSubmitter.getSubmissionHistory()).toHaveLength(5);
    });

    it('should handle queue backlog correctly', async () => {
      proofSubmitter.pauseSubmissions();

      const proof1Promise = proofSubmitter.submitProof(mockProof, mockWalletClient as WalletClient);
      const proof2Promise = proofSubmitter.submitProof(
        { ...mockProof, metadata: { ...mockProof.metadata, sessionId: 'session-2' } },
        mockWalletClient as WalletClient
      );

      proofSubmitter.resumeSubmissions();

      const [result1, result2] = await Promise.all([proof1Promise, proof2Promise]);

      expect(result1.valid).toBe(true);
      expect(result2.valid).toBe(true);
    });
  });

  describe('Error Edge Cases', () => {
    it('should handle malformed proof gracefully', async () => {
      const malformedProof = { ...mockProof, proof: null } as any;

      mockContractClient.submitProof.mockRejectedValue(new Error('Malformed proof'));

      await expect(proofSubmitter.submitProof(malformedProof, mockWalletClient as WalletClient))
        .rejects.toThrow('Malformed proof');
    });

    it('should handle contract client initialization errors', () => {
      expect(() => new ProofSubmitter(null as any)).not.toThrow();
    });

    it('should handle wallet client connection issues', async () => {
      const disconnectedWallet = null as any;
      mockContractClient.submitProof.mockRejectedValue(new Error('Wallet not connected'));

      await expect(proofSubmitter.submitProof(mockProof, disconnectedWallet))
        .rejects.toThrow('Wallet not connected');
    });
  });
});