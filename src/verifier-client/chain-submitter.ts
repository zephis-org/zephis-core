import { 
  createPublicClient, 
  http,
  type PublicClient,
  type WalletClient,
  type Hash,
  type Address
} from 'viem';
import { mainnet, sepolia, polygon, arbitrum } from 'viem/chains';
import type { ProofBundle, BatchProofBundle } from './proof-bundler';

export interface ChainConfig {
  chainId: number;
  rpcUrl: string;
  verifierContract: Address;
  batchVerifierContract: Address;
}

export interface SubmissionResult {
  success: boolean;
  transactionHash?: Hash;
  blockNumber?: bigint;
  gasUsed?: bigint;
  error?: string;
}

export interface BatchSubmissionResult {
  success: boolean;
  results: SubmissionResult[];
  totalGasUsed: bigint;
  batchTransactionHash?: Hash;
  error?: string;
}

export class ChainSubmitter {
  private publicClient: PublicClient;
  private walletClient: WalletClient | null = null;
  private config: ChainConfig;

  constructor(config: ChainConfig) {
    this.config = config;
    
    // Determine chain based on chainId
    const chain = this.getChainFromId(config.chainId);
    
    this.publicClient = createPublicClient({
      chain,
      transport: http(config.rpcUrl)
    });
  }

  private getChainFromId(chainId: number) {
    switch (chainId) {
      case 1: return mainnet;
      case 11155111: return sepolia;
      case 137: return polygon;
      case 42161: return arbitrum;
      default: return mainnet;
    }
  }

  public setWalletClient(walletClient: WalletClient): void {
    this.walletClient = walletClient;
  }

  public async submitProof(
    proofBundle: ProofBundle
  ): Promise<SubmissionResult> {
    if (!this.walletClient) {
      return { success: false, error: 'Wallet client not configured' };
    }

    try {
      // Format the proof bundle for contract submission
      const formattedProof = this.formatProofForContract(proofBundle);
      
      // Submit the transaction
      const hash = await this.walletClient.writeContract({
        address: this.config.verifierContract,
        abi: this.getVerifierABI(),
        functionName: 'verifyProofBundle',
        args: [
          formattedProof.handshakeProof,
          formattedProof.sessionProof,
          formattedProof.dataProof,
          proofBundle.metadata.sessionId
        ],
        account: this.walletClient.account || null,
        chain: this.walletClient.chain
      });

      // Wait for transaction receipt
      const receipt = await this.publicClient.waitForTransactionReceipt({
        hash,
        confirmations: 1
      });

      return {
        success: true,
        transactionHash: hash,
        blockNumber: receipt.blockNumber,
        gasUsed: receipt.gasUsed
      };

    } catch (error) {
      return {
        success: false,
        error: `Transaction failed: ${error}`
      };
    }
  }

  public async submitBatchProof(
    batchBundle: BatchProofBundle
  ): Promise<BatchSubmissionResult> {
    if (!this.walletClient) {
      return { 
        success: false, 
        results: [],
        totalGasUsed: BigInt(0),
        error: 'Wallet client not configured'
      };
    }

    try {
      // Format batch proofs for contract submission
      const formattedProofs = batchBundle.proofs.map(proof => ({
        handshakeProof: this.formatGrothProof(proof.handshakeProof.proof),
        sessionProof: this.formatGrothProof(proof.sessionProof.proof),
        dataProof: this.formatGrothProof(proof.dataProof.proof),
        handshakeInputs: this.formatPublicInputs(proof.handshakeProof.publicInputs),
        sessionInputs: this.formatPublicInputs(proof.sessionProof.publicInputs),
        dataInputs: this.formatPublicInputs(proof.dataProof.publicInputs),
        sessionId: proof.metadata.sessionId
      }));

      // Submit the batch transaction
      const hash = await this.walletClient.writeContract({
        address: this.config.batchVerifierContract,
        abi: this.getBatchVerifierABI(),
        functionName: 'verifyBatchProofs',
        args: [
          formattedProofs,
          `0x${batchBundle.batchCommitment}` as `0x${string}`,
          `0x${batchBundle.merkleRoot}` as `0x${string}`
        ],
        account: this.walletClient.account || null,
        chain: this.walletClient.chain
      });

      // Wait for transaction receipt
      const receipt = await this.publicClient.waitForTransactionReceipt({
        hash,
        confirmations: 1
      });

      // Create individual results for each proof in the batch
      const results: SubmissionResult[] = batchBundle.proofs.map(() => ({
        success: true,
        transactionHash: hash,
        blockNumber: receipt.blockNumber,
        gasUsed: receipt.gasUsed / BigInt(batchBundle.proofs.length)
      }));

      return {
        success: true,
        results,
        totalGasUsed: receipt.gasUsed,
        batchTransactionHash: hash
      };

    } catch (error) {
      return {
        success: false,
        results: [],
        totalGasUsed: BigInt(0),
        error: `Batch transaction failed: ${error}`
      };
    }
  }

  public async getVerificationResult(
    transactionHash: Hash,
    sessionId: string
  ): Promise<{
    verified: boolean;
    proofData?: any;
    error?: string;
  }> {
    try {
      // Get transaction receipt to verify the transaction was successful
      const receipt = await this.publicClient.waitForTransactionReceipt({
        hash: transactionHash,
        confirmations: 1
      });

      // Parse events from the transaction receipt to get verification data
      const events = await this.publicClient.getContractEvents({
        address: this.config.verifierContract,
        abi: this.getVerifierABI(),
        eventName: 'ProofVerified',
        fromBlock: receipt.blockNumber,
        toBlock: receipt.blockNumber,
        args: { sessionId }
      });

      if (events.length > 0) {
        const event = events[0];
        return {
          verified: true,
          proofData: {
            sessionId,
            verifier: event.args.verifier,
            timestamp: Number(event.args.timestamp),
            blockNumber: receipt.blockNumber.toString(),
            transactionHash
          }
        };
      } else {
        return { verified: false, error: 'No ProofVerified event found' };
      }
    } catch (error) {
      return { verified: false, error: `Failed to get verification result: ${error}` };
    }
  }

  public async estimateGasCost(proofBundle: ProofBundle): Promise<{
    gasLimit: bigint;
    gasPrice: bigint;
    estimatedCost: bigint;
  }> {
    try {
      // Format the proof bundle for contract submission
      const formattedProof = this.formatProofForContract(proofBundle);
      
      // Estimate gas for the actual transaction
      const gasLimit = await this.publicClient.estimateContractGas({
        address: this.config.verifierContract,
        abi: this.getVerifierABI(),
        functionName: 'verifyProofBundle',
        args: [
          formattedProof.handshakeProof,
          formattedProof.sessionProof,
          formattedProof.dataProof,
          proofBundle.metadata.sessionId
        ]
      });

      const gasPrice = await this.publicClient.getGasPrice();
      const estimatedCost = gasLimit * gasPrice;

      return { gasLimit, gasPrice, estimatedCost };

    } catch (error) {
      throw new Error(`Gas estimation failed: ${error}`);
    }
  }

  public async waitForConfirmations(
    transactionHash: Hash,
    confirmations: number = 3
  ): Promise<boolean> {
    try {
      // Wait for the specified number of confirmations
      const receipt = await this.publicClient.waitForTransactionReceipt({
        hash: transactionHash,
        confirmations
      });
      
      // Return true if transaction was successful
      return receipt.status === 'success';
    } catch (error) {
      return false;
    }
  }

  private formatProofForContract(proofBundle: any): {
    handshakeProof: { proof: readonly [bigint, bigint, bigint, bigint, bigint, bigint, bigint, bigint]; publicInputs: readonly bigint[] };
    sessionProof: { proof: readonly [bigint, bigint, bigint, bigint, bigint, bigint, bigint, bigint]; publicInputs: readonly bigint[] };
    dataProof: { proof: readonly [bigint, bigint, bigint, bigint, bigint, bigint, bigint, bigint]; publicInputs: readonly bigint[] };
  } {
    return {
      handshakeProof: {
        proof: this.formatGrothProof(proofBundle.handshakeProof.proof),
        publicInputs: this.formatPublicInputs(proofBundle.handshakeProof.publicSignals) as readonly bigint[]
      },
      sessionProof: {
        proof: this.formatGrothProof(proofBundle.sessionProof.proof),
        publicInputs: this.formatPublicInputs(proofBundle.sessionProof.publicSignals) as readonly bigint[]
      },
      dataProof: {
        proof: this.formatGrothProof(proofBundle.dataProof.proof),
        publicInputs: this.formatPublicInputs(proofBundle.dataProof.publicSignals) as readonly bigint[]
      }
    };
  }

  private formatGrothProof(proof: any): readonly [bigint, bigint, bigint, bigint, bigint, bigint, bigint, bigint] {
    return [
      BigInt(proof.pi_a?.[0] || 0),
      BigInt(proof.pi_a?.[1] || 0),
      BigInt(proof.pi_b?.[0]?.[1] || 0),
      BigInt(proof.pi_b?.[0]?.[0] || 0),
      BigInt(proof.pi_b?.[1]?.[1] || 0),
      BigInt(proof.pi_b?.[1]?.[0] || 0),
      BigInt(proof.pi_c?.[0] || 0),
      BigInt(proof.pi_c?.[1] || 0)
    ] as const;
  }

  private formatPublicInputs(inputs: string[]): bigint[] {
    return inputs.map(input => BigInt(input));
  }

  private getVerifierABI() {
    return [
      {
        name: 'verifyProofBundle',
        type: 'function',
        stateMutability: 'nonpayable',
        inputs: [
          { name: 'handshakeProof', type: 'tuple', components: [
            { name: 'proof', type: 'uint256[8]' },
            { name: 'publicInputs', type: 'uint256[]' }
          ]},
          { name: 'sessionProof', type: 'tuple', components: [
            { name: 'proof', type: 'uint256[8]' },
            { name: 'publicInputs', type: 'uint256[]' }
          ]},
          { name: 'dataProof', type: 'tuple', components: [
            { name: 'proof', type: 'uint256[8]' },
            { name: 'publicInputs', type: 'uint256[]' }
          ]},
          { name: 'sessionId', type: 'string' }
        ],
        outputs: [{ name: 'success', type: 'bool' }]
      },
      {
        name: 'ProofVerified',
        type: 'event',
        inputs: [
          { name: 'sessionId', type: 'string', indexed: true },
          { name: 'verifier', type: 'address', indexed: true },
          { name: 'timestamp', type: 'uint256', indexed: false }
        ]
      }
    ] as const;
  }

  private getBatchVerifierABI() {
    return [
      {
        name: 'verifyBatchProofs',
        type: 'function',
        stateMutability: 'nonpayable',
        inputs: [
          { 
            name: 'proofs', 
            type: 'tuple[]',
            components: [
              { name: 'handshakeProof', type: 'uint256[8]' },
              { name: 'sessionProof', type: 'uint256[8]' },
              { name: 'dataProof', type: 'uint256[8]' },
              { name: 'handshakeInputs', type: 'uint256[]' },
              { name: 'sessionInputs', type: 'uint256[]' },
              { name: 'dataInputs', type: 'uint256[]' },
              { name: 'sessionId', type: 'string' }
            ]
          },
          { name: 'batchCommitment', type: 'bytes32' },
          { name: 'merkleRoot', type: 'bytes32' }
        ],
        outputs: [{ name: 'success', type: 'bool' }]
      }
    ] as const;
  }
}