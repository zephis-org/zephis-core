import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ContractClient } from '../../src/blockchain/contract-client';
import { createPublicClient, createWalletClient, http } from 'viem';
import { mainnet } from 'viem/chains';

vi.mock('viem', () => ({
  createPublicClient: vi.fn(),
  createWalletClient: vi.fn(),
  http: vi.fn(),
  parseAbi: vi.fn((abi) => abi),
  mainnet: { id: 1, name: 'Ethereum' },
  sepolia: { id: 11155111, name: 'Sepolia' },
  polygon: { id: 137, name: 'Polygon' },
  arbitrum: { id: 42161, name: 'Arbitrum' },
  optimism: { id: 10, name: 'Optimism' }
}));

describe('ContractClient', () => {
  let contractClient: ContractClient;
  let mockPublicClient: any;
  let mockWalletClient: any;

  beforeEach(() => {
    mockPublicClient = {
      readContract: vi.fn(),
      simulateContract: vi.fn(),
      waitForTransactionReceipt: vi.fn(),
      watchContractEvent: vi.fn(),
      getBlockNumber: vi.fn(),
      getChainId: vi.fn(),
      getLogs: vi.fn()
    };

    mockWalletClient = {
      account: { address: '0x123' },
      writeContract: vi.fn()
    };

    (createPublicClient as any).mockReturnValue(mockPublicClient);
    (createWalletClient as any).mockReturnValue(mockWalletClient);
    (http as any).mockReturnValue('http-transport');

    contractClient = new ContractClient(
      'https://eth.test.com',
      1,
      '0xContractAddress' as any
    );
  });

  describe('constructor', () => {
    it('should create client with correct chain', () => {
      expect(createPublicClient).toHaveBeenCalledWith({
        chain: mainnet,
        transport: 'http-transport'
      });
    });

    it('should handle different chain IDs', () => {
      new ContractClient('https://test.com', 137);
      new ContractClient('https://test.com', 42161);
      new ContractClient('https://test.com', 10);
      new ContractClient('https://test.com', 11155111);
      
      expect(createPublicClient).toHaveBeenCalledTimes(5);
    });

    it('should default to mainnet for unknown chain', () => {
      new ContractClient('https://test.com', 999999);
      
      expect(createPublicClient).toHaveBeenCalledWith(
        expect.objectContaining({
          chain: mainnet
        })
      );
    });
  });

  describe('verifyProof', () => {
    it('should verify proof on-chain', async () => {
      const mockProof = global.testUtils.generateMockProof();
      const mockHash = '0x123abc';
      
      mockPublicClient.simulateContract.mockResolvedValue({
        request: { functionName: 'verifyProof' }
      });
      
      // Mock getWalletClient - since verifyProof now needs a wallet
      (contractClient as any).getWalletClient = vi.fn().mockResolvedValue(mockWalletClient);
      mockWalletClient.writeContract.mockResolvedValue(mockHash);
      
      mockPublicClient.waitForTransactionReceipt.mockResolvedValue({
        status: 'success',
        transactionHash: mockHash
      });

      const result = await contractClient.verifyProof(mockProof);

      expect(result).toEqual({
        valid: true,
        timestamp: expect.any(Number),
        transactionHash: mockHash
      });

      expect(mockPublicClient.simulateContract).toHaveBeenCalledWith({
        address: '0xContractAddress',
        abi: expect.any(Array),
        functionName: 'verifyProof',
        args: expect.arrayContaining([
          expect.objectContaining({
            a: expect.any(Array),
            b: expect.any(Array),
            c: expect.any(Array)
          }),
          expect.objectContaining({
            sessionHash: expect.any(String),
            claimHash: expect.any(String),
            timestamp: expect.any(BigInt),
            issuer: expect.any(String)
          })
        ])
      });
    });

    it('should handle verification failure', async () => {
      const mockProof = global.testUtils.generateMockProof();
      
      mockPublicClient.simulateContract.mockResolvedValue({
        request: { functionName: 'verifyProof' }
      });
      
      (contractClient as any).getWalletClient = vi.fn().mockResolvedValue(mockWalletClient);
      mockWalletClient.writeContract.mockResolvedValue('0x123');
      
      mockPublicClient.waitForTransactionReceipt.mockResolvedValue({
        status: 'reverted'
      });

      const result = await contractClient.verifyProof(mockProof);

      expect(result.valid).toBe(false);
    });

    it('should handle contract errors', async () => {
      const mockProof = global.testUtils.generateMockProof();
      mockPublicClient.simulateContract.mockRejectedValue(new Error('Contract error'));

      const result = await contractClient.verifyProof(mockProof);

      expect(result).toEqual({
        valid: false,
        timestamp: expect.any(Number),
        error: 'Contract error'
      });
    });

    it('should throw if contract address not set', async () => {
      const client = new ContractClient('https://test.com', 1);
      const mockProof = global.testUtils.generateMockProof();

      await expect(client.verifyProof(mockProof))
        .rejects.toThrow('Contract address not set');
    });
  });

  describe('submitProof', () => {
    it('should submit proof to blockchain using verifyProofWithWallet', async () => {
      const mockProof = global.testUtils.generateMockProof();
      const txHash = '0xTxHash';
      
      mockPublicClient.simulateContract.mockResolvedValue({
        request: { data: 'request-data' }
      });
      mockWalletClient.writeContract.mockResolvedValue(txHash);
      mockPublicClient.waitForTransactionReceipt.mockResolvedValue({
        status: 'success'
      });

      const result = await contractClient.submitProof(mockProof, mockWalletClient);

      expect(result).toEqual({
        valid: true,
        timestamp: expect.any(Number),
        transactionHash: txHash,
        verifier: '0x123'
      });

      expect(mockPublicClient.simulateContract).toHaveBeenCalled();
      expect(mockWalletClient.writeContract).toHaveBeenCalled();
      expect(mockPublicClient.waitForTransactionReceipt).toHaveBeenCalledWith({
        hash: txHash,
        confirmations: 2
      });
    });

    it('should handle submission failure', async () => {
      const mockProof = global.testUtils.generateMockProof();
      
      mockPublicClient.simulateContract.mockRejectedValue(new Error('Simulation failed'));

      const result = await contractClient.submitProof(mockProof, mockWalletClient);

      expect(result).toEqual({
        valid: false,
        timestamp: expect.any(Number),
        error: 'Simulation failed'
      });
    });

    it('should handle transaction failure', async () => {
      const mockProof = global.testUtils.generateMockProof();
      
      mockPublicClient.simulateContract.mockResolvedValue({
        request: { data: 'request-data' }
      });
      mockWalletClient.writeContract.mockResolvedValue('0xTxHash');
      mockPublicClient.waitForTransactionReceipt.mockResolvedValue({
        status: 'reverted'
      });

      const result = await contractClient.submitProof(mockProof, mockWalletClient);

      expect(result.valid).toBe(false);
    });
  });

  describe('getProofStatus', () => {
    it('should get proof status from events', async () => {
      mockPublicClient.getLogs.mockResolvedValue([
        {
          args: {
            sessionHash: '0xSession',
            claimHash: '0xClaim',
            verifier: '0xVerifier',
            timestamp: BigInt(1234567890)
          }
        }
      ]);

      const result = await contractClient.getProofStatus('0xProofHash' as any);

      expect(result).toEqual({
        verified: true,
        timestamp: 1234567890
      });
    });

    it('should throw if contract address not set', async () => {
      const client = new ContractClient('https://test.com', 1);

      await expect(client.getProofStatus('0xHash' as any))
        .rejects.toThrow('Contract address not set');
    });
  });

  describe('watchProofEvents', () => {
    it('should watch contract events', async () => {
      const mockUnwatch = vi.fn();
      mockPublicClient.watchContractEvent.mockReturnValue(mockUnwatch);

      const callback = vi.fn();
      const unwatch = await contractClient.watchProofEvents(callback);

      expect(mockPublicClient.watchContractEvent).toHaveBeenCalledWith({
        address: '0xContractAddress',
        abi: expect.any(Array),
        eventName: 'ProofVerified',
        onLogs: expect.any(Function)
      });

      expect(unwatch).toBe(mockUnwatch);
    });

    it('should call callback on events', async () => {
      const callback = vi.fn();
      let capturedOnLogs: any;

      mockPublicClient.watchContractEvent.mockImplementation(({ onLogs }) => {
        capturedOnLogs = onLogs;
        return vi.fn();
      });

      await contractClient.watchProofEvents(callback);

      const mockLogs = [{ event: 'ProofSubmitted', data: 'test' }];
      capturedOnLogs(mockLogs);

      expect(callback).toHaveBeenCalledWith(mockLogs[0]);
    });
  });

  describe('utility methods', () => {
    it('should get block number', async () => {
      mockPublicClient.getBlockNumber.mockResolvedValue(BigInt(12345));

      const blockNumber = await contractClient.getBlockNumber();

      expect(blockNumber).toBe(BigInt(12345));
    });

    it('should get chain ID', async () => {
      mockPublicClient.getChainId.mockResolvedValue(1);

      const chainId = await contractClient.getChainId();

      expect(chainId).toBe(1);
    });

    it('should set and get contract address', () => {
      const newAddress = '0xNewAddress' as any;
      
      contractClient.setContractAddress(newAddress);
      
      expect(contractClient.getContractAddress()).toBe(newAddress);
    });
  });

  describe('formatProofForContract', () => {
    it('should format proof correctly', async () => {
      const mockProof = global.testUtils.generateMockProof();
      
      mockPublicClient.simulateContract.mockResolvedValue({
        request: { functionName: 'verifyProof' }
      });
      
      // Mock getWalletClient since verifyProof needs it
      (contractClient as any).getWalletClient = vi.fn().mockResolvedValue(mockWalletClient);
      mockWalletClient.writeContract.mockResolvedValue('0x123');
      mockPublicClient.waitForTransactionReceipt.mockResolvedValue({
        status: 'success',
        transactionHash: '0x123'
      });
      
      await contractClient.verifyProof(mockProof);

      // Check simulateContract was called with correct proof format
      expect(mockPublicClient.simulateContract).toHaveBeenCalled();
      const simulateCall = mockPublicClient.simulateContract.mock.calls[0][0];
      const [proofData, publicInputs] = simulateCall.args;
      
      // Check proof data structure
      expect(proofData).toHaveProperty('a');
      expect(proofData).toHaveProperty('b');
      expect(proofData).toHaveProperty('c');
      expect(proofData.a).toHaveLength(2);
      expect(proofData.b).toHaveLength(2);
      expect(proofData.b[0]).toHaveLength(2);
      expect(proofData.b[1]).toHaveLength(2);
      expect(proofData.c).toHaveLength(2);
      
      // Check proof values are formatted as BigInts
      expect(proofData.a[0]).toBe(BigInt(1));
      expect(proofData.a[1]).toBe(BigInt(2));
      expect(proofData.b[0][0]).toBe(BigInt(3));
      expect(proofData.b[0][1]).toBe(BigInt(4));
      expect(proofData.b[1][0]).toBe(BigInt(5));
      expect(proofData.b[1][1]).toBe(BigInt(6));
      expect(proofData.c[0]).toBe(BigInt(7));
      expect(proofData.c[1]).toBe(BigInt(8));
    });
  });
});