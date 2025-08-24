import { Chain, Address } from "viem";
import {
  mainnet,
  sepolia,
  polygon,
  arbitrum,
  optimism,
  base,
} from "viem/chains";
import logger from "../utils/logger";

interface ChainConfig {
  chain: Chain;
  rpcUrl: string;
  contractAddress?: Address;
  blockExplorer: string;
  confirmations: number;
}

export class ChainManager {
  private chains: Map<number, ChainConfig> = new Map();
  private activeChainId: number;

  constructor() {
    this.setupDefaultChains();
    this.activeChainId = 1;
  }

  private setupDefaultChains(): void {
    const defaultConfigs: ChainConfig[] = [
      {
        chain: mainnet,
        rpcUrl: process.env.MAINNET_RPC_URL || "https://eth.llamarpc.com",
        blockExplorer: "https://etherscan.io",
        confirmations: 2,
      },
      {
        chain: sepolia,
        rpcUrl: process.env.SEPOLIA_RPC_URL || "https://rpc.sepolia.org",
        blockExplorer: "https://sepolia.etherscan.io",
        confirmations: 1,
      },
      {
        chain: polygon,
        rpcUrl: process.env.POLYGON_RPC_URL || "https://polygon-rpc.com",
        blockExplorer: "https://polygonscan.com",
        confirmations: 3,
      },
      {
        chain: arbitrum,
        rpcUrl: process.env.ARBITRUM_RPC_URL || "https://arb1.arbitrum.io/rpc",
        blockExplorer: "https://arbiscan.io",
        confirmations: 1,
      },
      {
        chain: optimism,
        rpcUrl: process.env.OPTIMISM_RPC_URL || "https://mainnet.optimism.io",
        blockExplorer: "https://optimistic.etherscan.io",
        confirmations: 1,
      },
      {
        chain: base,
        rpcUrl: process.env.BASE_RPC_URL || "https://mainnet.base.org",
        blockExplorer: "https://basescan.org",
        confirmations: 1,
      },
    ];

    for (const config of defaultConfigs) {
      this.chains.set(config.chain.id, config);
    }
  }

  addChain(config: ChainConfig): void {
    this.chains.set(config.chain.id, config);
    logger.info(`Added chain: ${config.chain.name} (${config.chain.id})`);
  }

  getChain(chainId: number): ChainConfig | undefined {
    return this.chains.get(chainId);
  }

  getActiveChain(): ChainConfig {
    const chain = this.chains.get(this.activeChainId);
    if (!chain) {
      throw new Error(`Active chain ${this.activeChainId} not found`);
    }
    return chain;
  }

  setActiveChain(chainId: number): void {
    if (!this.chains.has(chainId)) {
      throw new Error(`Chain ${chainId} not configured`);
    }
    this.activeChainId = chainId;
    logger.info(`Active chain set to ${chainId}`);
  }

  setContractAddress(chainId: number, address: Address): void {
    const chain = this.chains.get(chainId);
    if (!chain) {
      throw new Error(`Chain ${chainId} not found`);
    }
    chain.contractAddress = address;
    logger.info(`Contract address set for chain ${chainId}: ${address}`);
  }

  getContractAddress(chainId: number): Address | undefined {
    return this.chains.get(chainId)?.contractAddress;
  }

  getRpcUrl(chainId: number): string {
    const chain = this.chains.get(chainId);
    if (!chain) {
      throw new Error(`Chain ${chainId} not found`);
    }
    return chain.rpcUrl;
  }

  getBlockExplorer(chainId: number): string {
    const chain = this.chains.get(chainId);
    if (!chain) {
      throw new Error(`Chain ${chainId} not found`);
    }
    return chain.blockExplorer;
  }

  getTransactionUrl(chainId: number, txHash: string): string {
    const explorer = this.getBlockExplorer(chainId);
    return `${explorer}/tx/${txHash}`;
  }

  getAddressUrl(chainId: number, address: string): string {
    const explorer = this.getBlockExplorer(chainId);
    return `${explorer}/address/${address}`;
  }

  getSupportedChains(): number[] {
    return Array.from(this.chains.keys());
  }

  getChainName(chainId: number): string {
    const chain = this.chains.get(chainId);
    return chain ? chain.chain.name : "Unknown";
  }

  getConfirmations(chainId: number): number {
    const chain = this.chains.get(chainId);
    return chain ? chain.confirmations : 2;
  }

  isChainSupported(chainId: number): boolean {
    return this.chains.has(chainId);
  }

  getChainInfo(chainId: number): {
    id: number;
    name: string;
    nativeCurrency: {
      name: string;
      symbol: string;
      decimals: number;
    };
    rpcUrl: string;
    blockExplorer: string;
    contractAddress?: Address;
  } | null {
    const config = this.chains.get(chainId);
    if (!config) return null;

    return {
      id: config.chain.id,
      name: config.chain.name,
      nativeCurrency: config.chain.nativeCurrency,
      rpcUrl: config.rpcUrl,
      blockExplorer: config.blockExplorer,
      contractAddress: config.contractAddress,
    };
  }
}
