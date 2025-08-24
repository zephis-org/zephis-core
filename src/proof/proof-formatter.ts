import crypto from "crypto";
import { ZKProof } from "../types";
import logger from "../utils/logger";

export class ProofFormatter {
  formatForChain(proof: ZKProof): {
    proofData: bigint[];
    publicSignals: bigint[];
    metadata: any;
  } {
    try {
      // Convert proof arrays to flattened bigint array for smart contract
      const proofData: bigint[] = [
        BigInt(proof.proof.a[0]),
        BigInt(proof.proof.a[1]),
        // Note: b is in reverse order for pairing
        BigInt(proof.proof.b[0][1]),
        BigInt(proof.proof.b[0][0]),
        BigInt(proof.proof.b[1][1]),
        BigInt(proof.proof.b[1][0]),
        BigInt(proof.proof.c[0]),
        BigInt(proof.proof.c[1]),
      ];

      const publicSignals = proof.publicInputs.map((input) => BigInt(input));

      return {
        proofData,
        publicSignals,
        metadata: proof.metadata,
      };
    } catch (error) {
      logger.error("Failed to format proof for chain:", error);
      throw error;
    }
  }

  formatForStorage(proof: ZKProof): {
    id: string;
    proof: any;
    publicInputs: string[];
    metadata: any;
  } {
    const proofString = JSON.stringify({
      proof: proof.proof,
      publicInputs: proof.publicInputs,
    });

    const id = crypto.createHash("sha256").update(proofString).digest("hex");

    return {
      id,
      proof: proof.proof,
      publicInputs: proof.publicInputs,
      metadata: {
        ...proof.metadata,
        storedAt: Date.now(),
      },
    };
  }

  formatForPresentation(proof: ZKProof): {
    sessionId: string;
    template: string;
    claim: string;
    domain: string;
    timestamp: string;
    proofSummary: {
      valid: boolean;
      publicInputs: string[];
      circuitId: string;
    };
  } {
    return {
      sessionId: proof.metadata?.sessionId || "unknown",
      template: proof.metadata?.template || "unknown",
      claim: proof.metadata?.claim || "unknown",
      domain: proof.metadata?.domain || "unknown",
      timestamp: proof.metadata?.timestamp
        ? new Date(proof.metadata.timestamp).toISOString()
        : new Date().toISOString(),
      proofSummary: {
        valid: true,
        publicInputs: proof.publicInputs,
        circuitId: proof.metadata?.circuitId || "unknown",
      },
    };
  }

  parseFromStorage(storageFormat: {
    id: string;
    proof: any;
    publicInputs: string[];
    metadata: any;
  }): ZKProof {
    const {
      storedAt: _storedAt,
      storageLocation: _storageLocation,
      ...cleanMetadata
    } = storageFormat.metadata || {};

    return {
      proof: storageFormat.proof,
      publicInputs: storageFormat.publicInputs,
      metadata: cleanMetadata,
    };
  }

  parseFromChain(chainData: {
    proofData: bigint[];
    publicSignals: bigint[];
    metadata: any;
  }): ZKProof {
    if (chainData.proofData.length !== 8) {
      throw new Error("Invalid proof data length");
    }

    return {
      proof: {
        a: [
          chainData.proofData[0].toString(),
          chainData.proofData[1].toString(),
        ],
        b: [
          [
            chainData.proofData[3].toString(),
            chainData.proofData[2].toString(),
          ],
          [
            chainData.proofData[5].toString(),
            chainData.proofData[4].toString(),
          ],
        ],
        c: [
          chainData.proofData[6].toString(),
          chainData.proofData[7].toString(),
        ],
      },
      publicInputs: chainData.publicSignals.map((signal) => signal.toString()),
      metadata: chainData.metadata,
    };
  }

  validateFormat(proof: any): boolean {
    try {
      if (!proof || typeof proof !== "object") return false;
      if (!proof.proof || typeof proof.proof !== "object") return false;
      if (!proof.publicInputs || !Array.isArray(proof.publicInputs))
        return false;

      const { a, b, c } = proof.proof;
      if (!Array.isArray(a) || a.length < 2) return false;
      if (!Array.isArray(b) || b.length < 2) return false;
      if (!Array.isArray(c) || c.length < 2) return false;

      for (const bi of b) {
        if (!Array.isArray(bi) || bi.length < 2) return false;
      }

      return true;
    } catch {
      return false;
    }
  }

  compressProof(proof: ZKProof): any {
    return {
      p: proof.proof,
      i: proof.publicInputs,
      m: proof.metadata
        ? {
            s: proof.metadata.sessionId,
            t: proof.metadata.template,
            c: proof.metadata.claim,
            ts: proof.metadata.timestamp,
            d: proof.metadata.domain,
            ci: proof.metadata.circuitId,
          }
        : {},
    };
  }

  decompressProof(compressed: any): ZKProof {
    return {
      proof: compressed.p,
      publicInputs: compressed.i,
      metadata: compressed.m
        ? {
            sessionId: compressed.m.s,
            template: compressed.m.t,
            claim: compressed.m.c,
            timestamp: compressed.m.ts,
            domain: compressed.m.d,
            circuitId: compressed.m.ci,
          }
        : {
            sessionId: "unknown",
            template: "unknown",
            claim: "unknown",
            timestamp: 0,
            domain: "unknown",
            circuitId: "unknown",
          },
    };
  }

  toJSON(proof: ZKProof): string {
    return JSON.stringify(proof);
  }

  fromJSON(json: string): ZKProof {
    try {
      const parsed = JSON.parse(json);
      if (!this.validateFormat(parsed)) {
        throw new Error("Invalid proof format");
      }
      return parsed;
    } catch (error) {
      throw new Error(`Invalid JSON format: ${error}`);
    }
  }
}
