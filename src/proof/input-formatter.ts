import { ExtractedData, TLSSessionData } from "../types";
import crypto from "crypto";
import logger from "../utils/logger";

export class InputFormatter {
  formatInput(
    extractedData: ExtractedData,
    tlsData: TLSSessionData,
    claim: string,
  ): Record<string, any> {
    try {
      const input: Record<string, any> = {
        timestamp: Math.floor(tlsData.timestamp / 1000),
        domain: this.stringToFieldElements(extractedData.domain),
        url: this.stringToFieldElements(extractedData.url),
        clientRandom: this.hexToFieldElement(tlsData.sessionKeys.clientRandom),
        serverRandom: this.hexToFieldElement(tlsData.sessionKeys.serverRandom),
        masterSecret: this.hexToFieldElement(tlsData.sessionKeys.masterSecret),
      };

      for (const [key, value] of Object.entries(extractedData.processed)) {
        if (typeof value === "number") {
          input[key] = value.toString();
        } else if (typeof value === "string") {
          input[key] = this.stringToFieldElements(value);
        } else if (typeof value === "boolean") {
          input[key] = value ? "1" : "0";
        } else if (value instanceof Date) {
          input[key] = Math.floor(value.getTime() / 1000).toString();
        }
      }

      const claimInputs = this.formatClaimSpecificInputs(claim, extractedData);
      Object.assign(input, claimInputs);

      logger.debug("Formatted input for circuit:", {
        claim,
        inputKeys: Object.keys(input),
      });

      return input;
    } catch (error) {
      logger.error("Failed to format input:", error);
      throw error;
    }
  }

  private formatClaimSpecificInputs(
    claim: string,
    data: ExtractedData,
  ): Record<string, any> {
    const inputs: Record<string, any> = {};

    switch (claim) {
      case "balanceGreaterThan":
      case "hasMinimumBalance":
        inputs.balance = this.parseAmount(data.processed.balance);
        inputs.threshold = (data.processed.threshold || 0).toString();
        break;

      case "followersGreaterThan":
        inputs.followers = (data.processed.followers || 0).toString();
        inputs.threshold = (data.processed.threshold || 0).toString();
        break;

      case "isInfluencer":
        inputs.followers = (data.processed.followers || 0).toString();
        inputs.threshold = "10000"; // Default for influencer check
        break;

      case "hasVerifiedBadge":
        inputs.verified = data.processed.verified ? "1" : "0";
        break;

      case "accountAge":
        inputs.createdAt = data.processed.createdAt || "0";
        inputs.currentTime = Math.floor(Date.now() / 1000).toString();
        break;

      default:
        inputs.claimResult = "1";
    }

    return inputs;
  }

  private stringToFieldElements(str: string): string[] {
    const bytes = Buffer.from(str, "utf-8");
    const elements: string[] = [];

    for (let i = 0; i < bytes.length; i += 31) {
      const chunk = bytes.slice(i, Math.min(i + 31, bytes.length));
      const element = BigInt("0x" + chunk.toString("hex"));
      elements.push(element.toString());
    }

    return elements;
  }

  private hexToFieldElement(hex: string): string {
    try {
      const cleanHex = hex.startsWith("0x") ? hex.slice(2) : hex;

      // Validate hex string
      if (!/^[0-9a-fA-F]*$/.test(cleanHex)) {
        return "0";
      }

      const chunks: string[] = [];

      for (let i = 0; i < cleanHex.length; i += 62) {
        const chunk = cleanHex.slice(i, Math.min(i + 62, cleanHex.length));
        chunks.push(BigInt("0x" + chunk).toString());
      }

      return chunks[0] || "0";
    } catch {
      return "0";
    }
  }

  private parseAmount(value: any): string {
    if (typeof value === "number") {
      return Math.round(value * 100).toString();
    }

    if (typeof value === "string") {
      const cleaned = value.replace(/[^0-9.-]/g, "");
      const amount = parseFloat(cleaned);
      return isNaN(amount) ? "0" : Math.round(amount * 100).toString();
    }

    return "0";
  }

  validateInput(input: any): boolean {
    if (!input || typeof input !== "object") {
      return false;
    }

    for (const [_key, value] of Object.entries(input)) {
      if (value === null || value === undefined) {
        return false;
      }

      if (Array.isArray(value)) {
        // Arrays should contain valid field elements
        for (const element of value) {
          if (!this.isValidFieldElement(element)) {
            return false;
          }
        }
      } else if (typeof value === "string") {
        if (!this.isValidFieldElement(value)) {
          return false;
        }
      } else if (typeof value !== "number" && typeof value !== "boolean") {
        return false;
      }
    }

    return true;
  }

  private isValidFieldElement(value: any): boolean {
    if (typeof value !== "string") {
      return false;
    }

    // Field elements should be numeric strings (including negative)
    return /^-?\d+$/.test(value);
  }

  hashData(data: any): string {
    const seen = new Set();
    const str = JSON.stringify(data, (_key, val) => {
      if (val != null && typeof val === "object") {
        if (seen.has(val)) {
          return "[Circular]";
        }
        seen.add(val);
      }
      return val;
    });
    const hash = crypto.createHash("sha256").update(str).digest("hex");
    return BigInt("0x" + hash).toString();
  }

  formatTLSHandshake(handshakeMessages: string[]): string[] {
    return handshakeMessages.map((msg) => {
      const cleanHex = msg.startsWith("0x") ? msg.slice(2) : msg;
      return BigInt("0x" + cleanHex.slice(0, 62)).toString();
    });
  }

  formatCertificate(certificate: string): string[] {
    const certBytes = Buffer.from(certificate, "base64");
    const hash = crypto.createHash("sha256").update(certBytes).digest();

    const elements: string[] = [];
    for (let i = 0; i < hash.length; i += 16) {
      const chunk = hash.slice(i, Math.min(i + 16, hash.length));
      elements.push(BigInt("0x" + chunk.toString("hex")).toString());
    }

    return elements;
  }
}
