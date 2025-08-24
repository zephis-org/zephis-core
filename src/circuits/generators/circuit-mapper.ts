import { Template, ExtractedData, TLSSessionData } from "../../types";
import { createHash } from "crypto";
import logger from "../../utils/logger";

export interface CircuitInput {
  dataHash: string;
  claimHash: string;
  templateHash: string;
  threshold: number;
  timestamp: number;
  data: number[];
  claim: number[];
  dataType: number;
  claimType: number;
  actualValue: number;
}

export interface TemplateCircuitConfig {
  dataType: "numeric" | "string" | "boolean";
  claimType: "comparison" | "existence" | "pattern";
  maxDataLength: number;
}

export class CircuitMapper {
  /**
   * Converts template data and extracted data to circuit inputs
   */
  convertToCircuitInput(
    template: Template,
    extractedData: ExtractedData,
    _tlsData: TLSSessionData,
    claim: string,
    params: Record<string, any> = {},
  ): CircuitInput {
    logger.info(
      `Converting template data to circuit input for claim: ${claim}`,
    );

    const circuitConfig = this.getCircuitConfig(template, claim);

    // Extract the actual value based on the claim
    const actualValue = this.extractActualValue(extractedData, claim, params);

    // Convert data to numeric array for circuit
    const dataArray = this.convertDataToArray(
      extractedData,
      circuitConfig.maxDataLength,
    );

    // Convert claim parameters to numeric array
    const claimArray = this.convertClaimToArray(claim, params);

    // Generate hashes
    const dataHash = this.hashData(extractedData);
    const claimHash = this.hashClaim(claim, params);
    const templateHash = this.hashTemplate(template);

    // Determine threshold for comparisons
    const threshold = this.extractThreshold(claim, params);

    const circuitInput: CircuitInput = {
      dataHash: dataHash,
      claimHash: claimHash,
      templateHash: templateHash,
      threshold: threshold,
      timestamp: Math.floor(Date.now() / 1000), // Unix timestamp
      data: dataArray,
      claim: claimArray,
      dataType: this.getDataTypeNumber(circuitConfig.dataType),
      claimType: this.getClaimTypeNumber(circuitConfig.claimType),
      actualValue: actualValue,
    };

    logger.info(`Circuit input generated successfully`);
    return circuitInput;
  }

  /**
   * Gets circuit configuration for a specific template and claim
   */
  private getCircuitConfig(
    _template: Template,
    claim: string,
  ): TemplateCircuitConfig {
    // Default configuration - can be overridden by template-specific config
    const defaultConfig: TemplateCircuitConfig = {
      dataType: "numeric",
      claimType: "comparison",
      maxDataLength: 32,
    };

    // Map common claims to their configurations
    const claimConfigs: Record<string, Partial<TemplateCircuitConfig>> = {
      balanceGreaterThan: { dataType: "numeric", claimType: "comparison" },
      hasMinimumBalance: { dataType: "numeric", claimType: "comparison" },
      followersGreaterThan: { dataType: "numeric", claimType: "comparison" },
      isInfluencer: { dataType: "boolean", claimType: "existence" },
      hasVerifiedBadge: { dataType: "boolean", claimType: "existence" },
      accountAge: { dataType: "numeric", claimType: "comparison" },
      isVerifiedAccount: { dataType: "boolean", claimType: "existence" },
      hasRecentActivity: { dataType: "boolean", claimType: "existence" },
      currencyCheck: { dataType: "string", claimType: "pattern" },
    };

    const claimConfig = claimConfigs[claim] || {};
    return { ...defaultConfig, ...claimConfig };
  }

  /**
   * Extracts the actual value being proven from the extracted data
   */
  private extractActualValue(
    extractedData: ExtractedData,
    claim: string,
    params: Record<string, any>,
  ): number {
    const { raw } = extractedData;

    switch (claim) {
      case "balanceGreaterThan":
      case "hasMinimumBalance":
        const balance = raw.balance || raw.availableBalance || "0";
        return this.parseNumericValue(balance);

      case "followersGreaterThan":
        const followers = raw.followers || "0";
        return this.parseFollowerCount(followers);

      case "isInfluencer":
        const followerCount = this.parseFollowerCount(raw.followers || "0");
        return followerCount > 10000 ? 1 : 0;

      case "hasVerifiedBadge":
        return raw.verifiedBadge ? 1 : 0;

      case "isVerifiedAccount":
        const accountStatus = raw.accountStatus || "";
        return accountStatus.toLowerCase().includes("verified") ? 1 : 0;

      case "hasRecentActivity":
        const lastActivity = raw.lastActivity || raw.lastTransactionDate;
        if (!lastActivity) return 0;
        const daysSince = this.calculateDaysSince(lastActivity);
        return daysSince < 30 ? 1 : 0;

      case "currencyCheck":
        const currency = raw.currency || raw.primaryCurrency || "";
        const expectedCurrency = params.expectedCurrency || "USD";
        return currency === expectedCurrency ? 1 : 0;

      default:
        logger.warn(`Unknown claim type: ${claim}, returning 0`);
        return 0;
    }
  }

  /**
   * Converts extracted data to numeric array for circuit input
   */
  private convertDataToArray(
    extractedData: ExtractedData,
    maxLength: number,
  ): number[] {
    const dataString = JSON.stringify(extractedData.processed);
    const dataArray = Array.from(dataString).map((char) => char.charCodeAt(0));

    // Pad or truncate to maxLength
    if (dataArray.length > maxLength) {
      return dataArray.slice(0, maxLength);
    }

    while (dataArray.length < maxLength) {
      dataArray.push(0);
    }

    return dataArray;
  }

  /**
   * Converts claim and parameters to numeric array for circuit input
   */
  private convertClaimToArray(
    claim: string,
    params: Record<string, any>,
  ): number[] {
    const claimData = { claim, ...params };
    const claimString = JSON.stringify(claimData);
    const claimArray = Array.from(claimString).map((char) =>
      char.charCodeAt(0),
    );

    // Fixed length for claims - 16 elements
    const maxClaimLength = 16;
    if (claimArray.length > maxClaimLength) {
      return claimArray.slice(0, maxClaimLength);
    }

    while (claimArray.length < maxClaimLength) {
      claimArray.push(0);
    }

    return claimArray;
  }

  /**
   * Generates hash of extracted data
   */
  private hashData(extractedData: ExtractedData): string {
    const dataString = JSON.stringify(extractedData.processed);
    return this.generateNumericHash(dataString);
  }

  /**
   * Generates hash of claim and parameters
   */
  private hashClaim(claim: string, params: Record<string, any>): string {
    const claimData = { claim, ...params };
    const claimString = JSON.stringify(claimData);
    return this.generateNumericHash(claimString);
  }

  /**
   * Generates hash of template configuration
   */
  private hashTemplate(template: Template): string {
    const templateData = {
      domain: template.domain,
      name: template.name,
      version: template.version,
      selectors: template.selectors,
    };
    const templateString = JSON.stringify(templateData);
    return this.generateNumericHash(templateString);
  }

  /**
   * Generates a numeric hash suitable for circuit use
   */
  private generateNumericHash(input: string): string {
    const hash = createHash("sha256").update(input).digest("hex");
    // Convert first 8 bytes to a decimal number string
    return BigInt("0x" + hash.substring(0, 16)).toString();
  }

  /**
   * Extracts threshold value for comparison claims
   */
  private extractThreshold(claim: string, params: Record<string, any>): number {
    switch (claim) {
      case "balanceGreaterThan":
        return params.amount || 0;
      case "hasMinimumBalance":
        return params.minimum || 0;
      case "followersGreaterThan":
        return params.count || 0;
      default:
        return 0;
    }
  }

  /**
   * Converts data type to numeric value for circuit
   */
  private getDataTypeNumber(dataType: string): number {
    const typeMap = {
      numeric: 0,
      string: 1,
      boolean: 2,
    };
    return typeMap[dataType as keyof typeof typeMap] || 0;
  }

  /**
   * Converts claim type to numeric value for circuit
   */
  private getClaimTypeNumber(claimType: string): number {
    const typeMap = {
      comparison: 0,
      existence: 1,
      pattern: 2,
    };
    return typeMap[claimType as keyof typeof typeMap] || 0;
  }

  /**
   * Parses numeric values from strings, handling currency formatting
   */
  private parseNumericValue(value: string): number {
    if (!value) return 0;
    const cleaned = value.replace(/[$,\s]/g, "");
    const parsed = parseFloat(cleaned);
    return isNaN(parsed) ? 0 : Math.floor(parsed);
  }

  /**
   * Parses follower count, handling 'K' and 'M' abbreviations
   */
  private parseFollowerCount(followers: string): number {
    if (!followers) return 0;

    const cleaned = followers.replace(/[,\s]/g, "").toLowerCase();
    let multiplier = 1;

    if (cleaned.includes("k")) {
      multiplier = 1000;
    } else if (cleaned.includes("m")) {
      multiplier = 1000000;
    }

    const baseValue = parseFloat(cleaned.replace(/[km]/g, ""));
    return isNaN(baseValue) ? 0 : Math.floor(baseValue * multiplier);
  }

  /**
   * Calculates days since a given date
   */
  private calculateDaysSince(dateString: string): number {
    try {
      const date = new Date(dateString);
      const now = new Date();
      const diffTime = now.getTime() - date.getTime();
      return Math.floor(diffTime / (1000 * 60 * 60 * 24));
    } catch (error) {
      logger.error(`Error parsing date: ${dateString}`, error);
      return Number.MAX_SAFE_INTEGER; // Return large number to indicate very old
    }
  }

  /**
   * Validates circuit input before generation
   */
  validateCircuitInput(input: CircuitInput): boolean {
    try {
      // Check required fields
      if (!input.dataHash || !input.claimHash || !input.templateHash) {
        logger.error("Missing required hash fields in circuit input");
        return false;
      }

      // Check array lengths
      if (input.data.length > 32 || input.claim.length > 16) {
        logger.error("Data or claim arrays exceed maximum length");
        return false;
      }

      // Check timestamp validity
      const now = Math.floor(Date.now() / 1000);
      if (input.timestamp > now + 300 || input.timestamp < now - 86400) {
        // Allow 5min future, 24h past
        logger.error("Timestamp is outside valid range");
        return false;
      }

      // Check enum values
      if (input.dataType < 0 || input.dataType > 2) {
        logger.error("Invalid data type value");
        return false;
      }

      if (input.claimType < 0 || input.claimType > 2) {
        logger.error("Invalid claim type value");
        return false;
      }

      return true;
    } catch (error) {
      logger.error("Error validating circuit input:", error);
      return false;
    }
  }
}
