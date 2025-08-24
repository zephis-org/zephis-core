import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ChainManager } from '../../src/blockchain/chain-manager';

vi.mock('../../src/utils/logger', () => ({
  default: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn()
  }
}));

describe('ChainManager', () => {
  let chainManager: ChainManager;

  beforeEach(() => {
    vi.clearAllMocks();
    chainManager = new ChainManager();
  });

  describe('constructor', () => {
    it('should initialize with default chains', () => {
      expect(chainManager).toBeDefined();
      
      // Should have active chain set to mainnet (1)
      const activeChain = chainManager.getActiveChain();
      expect(activeChain.chain.id).toBe(1);
    });
  });

  describe('getActiveChain', () => {
    it('should return active chain', () => {
      const activeChain = chainManager.getActiveChain();
      
      expect(activeChain).toBeDefined();
      expect(activeChain.chain.id).toBe(1);
      expect(activeChain.chain.name).toBe('Ethereum');
    });
  });

  describe('setActiveChain', () => {
    it('should set active chain to valid chain', () => {
      chainManager.setActiveChain(137); // Polygon
      
      const activeChain = chainManager.getActiveChain();
      expect(activeChain.chain.id).toBe(137);
    });

    it('should throw error for invalid chain', () => {
      expect(() => chainManager.setActiveChain(99999)).toThrow('Chain 99999 not configured');
    });
  });

  describe('getChain', () => {
    it('should return chain config for valid chain ID', () => {
      const chain = chainManager.getChain(1);
      
      expect(chain).toBeDefined();
      expect(chain?.chain.id).toBe(1);
      expect(chain?.chain.name).toBe('Ethereum');
      expect(chain?.rpcUrl).toBeDefined();
      expect(chain?.blockExplorer).toBeDefined();
      expect(chain?.confirmations).toBeDefined();
    });

    it('should return undefined for invalid chain ID', () => {
      const chain = chainManager.getChain(99999);
      
      expect(chain).toBeUndefined();
    });
  });

  describe('addChain', () => {
    it('should add new chain configuration', () => {
      const newChain = {
        chain: { id: 56, name: 'BSC' } as any,
        rpcUrl: 'https://bsc-dataseed.binance.org/',
        blockExplorer: 'https://bscscan.com',
        confirmations: 3,
        contractAddress: '0x1234567890123456789012345678901234567890' as any
      };

      chainManager.addChain(newChain);

      const retrievedChain = chainManager.getChain(56);
      expect(retrievedChain).toBeDefined();
      expect(retrievedChain?.chain.id).toBe(56);
      expect(retrievedChain?.chain.name).toBe('BSC');
    });
  });

  describe('setContractAddress', () => {
    it('should set contract address for valid chain', () => {
      const address = '0x1234567890123456789012345678901234567890' as any;
      
      chainManager.setContractAddress(1, address);
      
      const chain = chainManager.getChain(1);
      expect(chain?.contractAddress).toBe(address);
    });

    it('should throw error for invalid chain', () => {
      const address = '0x1234567890123456789012345678901234567890' as any;
      
      expect(() => chainManager.setContractAddress(99999, address))
        .toThrow('Chain 99999 not found');
    });
  });

  describe('getContractAddress', () => {
    it('should return contract address for chain', () => {
      const address = '0x1234567890123456789012345678901234567890' as any;
      chainManager.setContractAddress(1, address);
      
      const retrievedAddress = chainManager.getContractAddress(1);
      expect(retrievedAddress).toBe(address);
    });

    it('should return undefined for chain without contract address', () => {
      const address = chainManager.getContractAddress(1);
      expect(address).toBeUndefined();
    });

    it('should return undefined for invalid chain', () => {
      const address = chainManager.getContractAddress(99999);
      expect(address).toBeUndefined();
    });
  });

  describe('getSupportedChains', () => {
    it('should return all supported chain IDs', () => {
      const chainIds = chainManager.getSupportedChains();
      
      expect(chainIds).toBeInstanceOf(Array);
      expect(chainIds.length).toBeGreaterThan(0);
      
      // Should include default chains
      expect(chainIds).toContain(1);    // Mainnet
      expect(chainIds).toContain(137);  // Polygon
      expect(chainIds).toContain(42161); // Arbitrum
      expect(chainIds).toContain(10);   // Optimism
      expect(chainIds).toContain(8453); // Base
    });
  });

  describe('isChainSupported', () => {
    it('should return true for supported chains', () => {
      expect(chainManager.isChainSupported(1)).toBe(true);
      expect(chainManager.isChainSupported(137)).toBe(true);
      expect(chainManager.isChainSupported(42161)).toBe(true);
    });

    it('should return false for unsupported chains', () => {
      expect(chainManager.isChainSupported(99999)).toBe(false);
      expect(chainManager.isChainSupported(-1)).toBe(false);
    });
  });

  describe('getChainName', () => {
    it('should return chain name for valid ID', () => {
      expect(chainManager.getChainName(1)).toBe('Ethereum');
      expect(chainManager.getChainName(137)).toBe('Polygon');
      expect(chainManager.getChainName(42161)).toBe('Arbitrum One');
    });

    it('should return Unknown for invalid chain', () => {
      expect(chainManager.getChainName(99999)).toBe('Unknown');
    });
  });

  describe('getRpcUrl', () => {
    it('should return RPC URL for valid chain', () => {
      const rpcUrl = chainManager.getRpcUrl(1);
      
      expect(rpcUrl).toBeDefined();
      expect(typeof rpcUrl).toBe('string');
      expect(rpcUrl.startsWith('http')).toBe(true);
    });

    it('should throw error for invalid chain', () => {
      expect(() => chainManager.getRpcUrl(99999))
        .toThrow('Chain 99999 not found');
    });
  });

  describe('getBlockExplorer', () => {
    it('should return block explorer URL for valid chain', () => {
      const explorerUrl = chainManager.getBlockExplorer(1);
      
      expect(explorerUrl).toBeDefined();
      expect(typeof explorerUrl).toBe('string');
      expect(explorerUrl.startsWith('http')).toBe(true);
    });

    it('should throw error for invalid chain', () => {
      expect(() => chainManager.getBlockExplorer(99999))
        .toThrow('Chain 99999 not found');
    });
  });

  describe('getConfirmations', () => {
    it('should return confirmation count for valid chain', () => {
      const confirmations = chainManager.getConfirmations(1);
      
      expect(confirmations).toBeDefined();
      expect(typeof confirmations).toBe('number');
      expect(confirmations).toBeGreaterThan(0);
    });

    it('should return default confirmations for invalid chain', () => {
      const confirmations = chainManager.getConfirmations(99999);
      
      expect(confirmations).toBe(2); // Default
    });
  });

  describe('getChainInfo', () => {
    it('should return chain info for valid chain', () => {
      const info = chainManager.getChainInfo(1);
      
      expect(info).toBeDefined();
      expect(info?.id).toBe(1);
      expect(info?.name).toBe('Ethereum');
      expect(info?.nativeCurrency).toBeDefined();
      expect(info?.rpcUrl).toBeDefined();
      expect(info?.blockExplorer).toBeDefined();
    });

    it('should return null for invalid chain', () => {
      const info = chainManager.getChainInfo(99999);
      
      expect(info).toBeNull();
    });
  });

  describe('getTransactionUrl', () => {
    it('should return transaction URL', () => {
      const txHash = '0x1234567890abcdef';
      const url = chainManager.getTransactionUrl(1, txHash);
      
      expect(url).toContain('etherscan.io');
      expect(url).toContain(txHash);
    });
  });

  describe('getAddressUrl', () => {
    it('should return address URL', () => {
      const address = '0x1234567890123456789012345678901234567890';
      const url = chainManager.getAddressUrl(1, address);
      
      expect(url).toContain('etherscan.io');
      expect(url).toContain(address);
    });
  });
});