import { WalletClient } from "viem";
import PQueue from "p-queue";
import { ZKProof, VerificationResult } from "../types";
import { ContractClient } from "./contract-client";
import logger from "../utils/logger";

export class ProofSubmitter {
  private contractClient: ContractClient;
  private queue: PQueue;
  private submissionHistory: Map<string, VerificationResult> = new Map();

  constructor(contractClient: ContractClient) {
    this.contractClient = contractClient;
    this.queue = new PQueue({ concurrency: 1, interval: 1000, intervalCap: 1 });
  }

  async submitProof(
    proof: ZKProof,
    walletClient: WalletClient,
  ): Promise<VerificationResult> {
    const proofId = this.generateProofId(proof);

    if (this.submissionHistory.has(proofId)) {
      logger.info(`Proof ${proofId} already submitted`);
      return this.submissionHistory.get(proofId)!;
    }

    const result = await this.queue.add(async () => {
      try {
        logger.info(`Submitting proof ${proofId} to blockchain`);

        const result = await this.contractClient.submitProof(
          proof,
          walletClient,
        );

        this.submissionHistory.set(proofId, result);

        if (result.valid) {
          logger.info(`Proof ${proofId} successfully submitted`);
        } else {
          logger.error(`Proof ${proofId} submission failed: ${result.error}`);
        }

        return result;
      } catch (error) {
        const errorResult: VerificationResult = {
          valid: false,
          timestamp: Date.now(),
          error: error instanceof Error ? error.message : "Unknown error",
        };

        this.submissionHistory.set(proofId, errorResult);
        throw error;
      }
    });
    return result as VerificationResult;
  }

  async batchSubmit(
    proofs: ZKProof[],
    walletClient: WalletClient,
  ): Promise<VerificationResult[]> {
    const results: VerificationResult[] = [];

    for (const proof of proofs) {
      try {
        const result = await this.submitProof(proof, walletClient);
        results.push(result);
      } catch (error) {
        logger.error("Failed to submit proof in batch:", error);
        results.push({
          valid: false,
          timestamp: Date.now(),
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }

    return results;
  }

  async verifyOnChain(proof: ZKProof): Promise<VerificationResult> {
    try {
      return await this.contractClient.verifyProof(proof);
    } catch (error) {
      logger.error("On-chain verification failed:", error);
      return {
        valid: false,
        timestamp: Date.now(),
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  private generateProofId(proof: ZKProof): string {
    const data = {
      sessionId: proof.metadata.sessionId,
      template: proof.metadata.template,
      claim: proof.metadata.claim,
      timestamp: proof.metadata.timestamp,
    };

    return Buffer.from(JSON.stringify(data)).toString("base64");
  }

  getSubmissionHistory(): VerificationResult[] {
    return Array.from(this.submissionHistory.values());
  }

  clearHistory(): void {
    this.submissionHistory.clear();
  }

  async retryFailedSubmissions(_walletClient: WalletClient): Promise<void> {
    const failed = Array.from(this.submissionHistory.entries()).filter(
      ([_, result]) => !result.valid,
    );

    logger.info(`Retrying ${failed.length} failed submissions`);

    for (const [proofId, _] of failed) {
      this.submissionHistory.delete(proofId);
    }
  }

  getQueueSize(): number {
    return this.queue.size;
  }

  async waitForQueue(): Promise<void> {
    await this.queue.onIdle();
  }

  pauseSubmissions(): void {
    this.queue.pause();
  }

  resumeSubmissions(): void {
    this.queue.start();
  }
}
