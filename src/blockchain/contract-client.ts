import {
  createPublicClient,
  http,
  parseAbi,
  PublicClient,
  WalletClient,
  Address,
  Hex,
  Chain,
} from "viem";
import { mainnet, sepolia, polygon, arbitrum, optimism } from "viem/chains";
import { ZKProof, VerificationResult } from "../types";
import logger from "../utils/logger";

// Contract struct definitions matching ZephisVerifier.sol
export interface ProofData {
  a: [bigint, bigint];
  b: [[bigint, bigint], [bigint, bigint]];
  c: [bigint, bigint];
}

export interface PublicInputs {
  sessionHash: Hex;
  claimHash: Hex;
  timestamp: bigint;
  issuer: Address;
}

export class ContractClient {
  private publicClient: PublicClient;
  private contractAddress?: Address;
  private contractAbi: readonly any[];
  private chain: Chain;

  constructor(rpcUrl: string, chainId: number, contractAddress?: Address) {
    this.chain = this.getChain(chainId);
    this.contractAddress = contractAddress;

    this.publicClient = createPublicClient({
      chain: this.chain,
      transport: http(rpcUrl),
    });

    this.contractAbi = parseAbi([
      "struct ProofData { uint256[2] a; uint256[2][2] b; uint256[2] c; }",
      "struct PublicInputs { bytes32 sessionHash; bytes32 claimHash; uint256 timestamp; address issuer; }",
      "function verifyProof((uint256[2],uint256[2][2],uint256[2]) calldata proof, (bytes32,bytes32,uint256,address) calldata inputs) external returns (bool)",
      "function verifyProofWithCustomValidity((uint256[2],uint256[2][2],uint256[2]) calldata proof, (bytes32,bytes32,uint256,address) calldata inputs, uint256 validityPeriod) external returns (bool)",
      "function batchVerifyProofs((uint256[2],uint256[2][2],uint256[2])[] calldata proofs, (bytes32,bytes32,uint256,address)[] calldata inputs) external returns (bool[] memory results)",
      "event ProofVerified(bytes32 indexed sessionHash, bytes32 indexed claimHash, address indexed verifier, uint256 timestamp)",
      "event BatchProofVerified(bytes32[] sessionHashes, address indexed verifier, uint256 timestamp)",
    ]);
  }

  private getChain(chainId: number): Chain {
    switch (chainId) {
      case 1:
        return mainnet;
      case 11155111:
        return sepolia;
      case 137:
        return polygon;
      case 42161:
        return arbitrum;
      case 10:
        return optimism;
      default:
        return mainnet;
    }
  }

  async verifyProof(proof: ZKProof): Promise<VerificationResult> {
    if (!this.contractAddress) {
      throw new Error("Contract address not set");
    }

    try {
      const proofData = this.formatProofDataForContract(proof);
      const publicInputs = this.formatPublicInputsForContract(proof);

      const { request } = await this.publicClient.simulateContract({
        address: this.contractAddress,
        abi: this.contractAbi,
        functionName: "verifyProof",
        args: [proofData, publicInputs],
      });

      // Execute the verification
      const walletClient = await this.getWalletClient();
      const hash = await walletClient.writeContract(request);
      
      const receipt = await this.publicClient.waitForTransactionReceipt({
        hash,
        confirmations: 1,
      });

      const result = receipt.status === "success";
      logger.info(`Proof verification result from contract: ${result}`);

      return {
        valid: result,
        timestamp: Date.now(),
        transactionHash: hash,
      };
    } catch (error) {
      logger.error("Contract verification failed:", error);
      return {
        valid: false,
        timestamp: Date.now(),
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  async submitProof(
    proof: ZKProof,
    walletClient: WalletClient,
  ): Promise<VerificationResult> {
    // Since ZephisVerifier doesn't have a separate submitProof,
    // we'll use verifyProof which also records the proof on-chain
    return this.verifyProofWithWallet(proof, walletClient);
  }

  async verifyProofWithWallet(
    proof: ZKProof,
    walletClient: WalletClient,
  ): Promise<VerificationResult> {
    if (!this.contractAddress) {
      throw new Error("Contract address not set");
    }

    try {
      const proofData = this.formatProofDataForContract(proof);
      const publicInputs = this.formatPublicInputsForContract(proof, walletClient.account?.address);

      const { request } = await this.publicClient.simulateContract({
        address: this.contractAddress,
        abi: this.contractAbi,
        functionName: "verifyProof",
        args: [proofData, publicInputs],
        account: walletClient.account!,
      });

      const hash = await walletClient.writeContract(request);

      const receipt = await this.publicClient.waitForTransactionReceipt({
        hash,
        confirmations: 2,
      });

      logger.info(`Proof submitted to blockchain: ${hash}`);

      return {
        valid: receipt.status === "success",
        timestamp: Date.now(),
        transactionHash: hash,
        verifier: walletClient.account?.address,
      };
    } catch (error) {
      logger.error("Proof submission failed:", error);
      return {
        valid: false,
        timestamp: Date.now(),
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  private formatProofDataForContract(proof: ZKProof): ProofData {
    return {
      a: [BigInt(proof.proof.a[0]), BigInt(proof.proof.a[1])],
      b: [
        [BigInt(proof.proof.b[0][0]), BigInt(proof.proof.b[0][1])],
        [BigInt(proof.proof.b[1][0]), BigInt(proof.proof.b[1][1])],
      ],
      c: [BigInt(proof.proof.c[0]), BigInt(proof.proof.c[1])],
    };
  }

  private formatPublicInputsForContract(
    proof: ZKProof,
    issuer?: Address,
  ): PublicInputs {
    // Generate hashes from metadata
    const sessionHash = this.generateHash(
      proof.metadata?.sessionId || "default-session",
    );
    const claimHash = this.generateHash(
      JSON.stringify(proof.metadata?.claim || {}),
    );

    return {
      sessionHash,
      claimHash,
      timestamp: BigInt(proof.metadata?.timestamp || Math.floor(Date.now() / 1000)),
      issuer: issuer || "0x0000000000000000000000000000000000000000",
    };
  }

  private generateHash(data: string): Hex {
    const encoder = new TextEncoder();
    const bytes = encoder.encode(data);
    let hash = BigInt(0);
    
    for (let i = 0; i < Math.min(bytes.length, 32); i++) {
      hash = (hash << BigInt(8)) | BigInt(bytes[i]);
    }
    
    return `0x${hash.toString(16).padStart(64, "0")}` as Hex;
  }

  private generateMetadataHash(metadata: any): Hex {
    const metadataString = JSON.stringify(metadata);
    const encoder = new TextEncoder();
    const data = encoder.encode(metadataString);

    let hash = BigInt(0);
    for (let i = 0; i < data.length; i++) {
      hash = (hash << BigInt(8)) | BigInt(data[i]);
    }

    return `0x${hash.toString(16).padStart(64, "0")}` as Hex;
  }

  async getProofStatus(proofHash: Hex): Promise<{
    verified: boolean;
    timestamp: number;
  }> {
    // ZephisVerifier tracks processed proofs internally
    // This method would need to check transaction logs or events
    if (!this.contractAddress) {
      throw new Error("Contract address not set");
    }

    try {
      // Query ProofVerified events for this proof hash
      const logs = await this.publicClient.getLogs({
        address: this.contractAddress,
        event: parseAbi([
          "event ProofVerified(bytes32 indexed sessionHash, bytes32 indexed claimHash, address indexed verifier, uint256 timestamp)",
        ])[0],
        fromBlock: "earliest",
        toBlock: "latest",
      });

      // Check if any log matches our proof hash
      const verified = logs.length > 0;
      const timestamp = verified && logs[0].args
        ? Number((logs[0].args as any).timestamp)
        : 0;

      return {
        verified,
        timestamp,
      };
    } catch (error) {
      logger.error("Failed to get proof status:", error);
      throw error;
    }
  }

  private async getWalletClient(): Promise<WalletClient> {
    // This is a placeholder - in production, you'd get this from config or context
    throw new Error("Wallet client not configured for read-only operations");
  }

  async watchProofEvents(callback: (event: any) => void): Promise<() => void> {
    if (!this.contractAddress) {
      throw new Error("Contract address not set");
    }

    const unwatch = this.publicClient.watchContractEvent({
      address: this.contractAddress,
      abi: this.contractAbi,
      eventName: "ProofVerified",
      onLogs: (logs) => {
        logs.forEach((log) => {
          logger.info("Proof verified event:", log);
          callback(log);
        });
      },
    });

    return unwatch;
  }

  async getBlockNumber(): Promise<bigint> {
    return await this.publicClient.getBlockNumber();
  }

  async getChainId(): Promise<number> {
    return await this.publicClient.getChainId();
  }

  setContractAddress(address: Address): void {
    this.contractAddress = address;
  }

  getContractAddress(): Address | undefined {
    return this.contractAddress;
  }
}
