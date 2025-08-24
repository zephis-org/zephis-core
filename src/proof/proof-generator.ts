// @ts-ignore
import snarkjs from "snarkjs";
import {
  ZKProof,
  ProofMetadata,
  ExtractedData,
  TLSSessionData,
  Template,
  CircuitInput,
  DynamicProofRequest,
} from "../types";
import { CircuitLoader } from "./circuit-loader";
import { InputFormatter } from "./input-formatter";
import { DynamicCircuitLoader } from "../circuits/generators/dynamic-circuit-loader";
import { CircuitMapper } from "../circuits/generators/circuit-mapper";
import { TemplateCircuitMapper } from "../template-engine/circuit-mapper";
import logger from "../utils/logger";

export class ProofGenerator {
  private circuitLoader: CircuitLoader;
  private inputFormatter: InputFormatter;
  private dynamicCircuitLoader: DynamicCircuitLoader;
  private circuitMapper: CircuitMapper;
  private templateCircuitMapper: TemplateCircuitMapper;

  constructor() {
    this.circuitLoader = new CircuitLoader();
    this.inputFormatter = new InputFormatter();
    this.dynamicCircuitLoader = new DynamicCircuitLoader();
    this.circuitMapper = new CircuitMapper();
    this.templateCircuitMapper = new TemplateCircuitMapper();
  }

  async generateProof(
    sessionId: string,
    template: Template,
    claim: string,
    extractedData: ExtractedData,
    tlsData: TLSSessionData,
    params?: Record<string, any>,
  ): Promise<ZKProof> {
    try {
      logger.info(
        `Generating dynamic proof for session ${sessionId}, claim: ${claim}`,
      );

      // Register template if not already registered
      this.templateCircuitMapper.registerTemplate(template);

      // Get circuit configuration for this template and claim
      const circuitConfig = this.templateCircuitMapper.getCircuitConfig(
        template.domain,
        claim,
      );
      if (!circuitConfig) {
        throw new Error(
          `No circuit configuration found for template ${template.domain} and claim ${claim}`,
        );
      }

      // Validate extracted data against circuit requirements
      const validation = this.templateCircuitMapper.validateDataForCircuit(
        template.domain,
        claim,
        extractedData,
        params || {},
      );

      if (!validation.isValid) {
        throw new Error(
          `Data validation failed: ${validation.errors.join(", ")}`,
        );
      }

      // Load or compile circuit assets
      const circuitAssets =
        await this.dynamicCircuitLoader.loadCircuitAssets(circuitConfig);

      // Generate circuit input using the template-specific mapper
      const circuitInput = this.templateCircuitMapper.generateCircuitInput(
        template,
        extractedData,
        tlsData,
        claim,
        params || {},
      );

      // Validate circuit input
      if (!this.circuitMapper.validateCircuitInput(circuitInput)) {
        throw new Error("Circuit input validation failed");
      }

      // Generate the actual proof
      const { proof, publicSignals } = await snarkjs.groth16.fullProve(
        this.convertCircuitInputForSnarkjs(circuitInput),
        circuitAssets.wasm,
        circuitAssets.zkey,
      );

      const metadata: ProofMetadata = {
        sessionId,
        template: template.name,
        claim,
        timestamp: Date.now(),
        domain: extractedData.domain,
        circuitId: circuitAssets.circuitInfo.name,
      };

      const zkProof: ZKProof = {
        proof: {
          a: [proof.pi_a[0].toString(), proof.pi_a[1].toString()],
          b: [
            [proof.pi_b[0][1].toString(), proof.pi_b[0][0].toString()],
            [proof.pi_b[1][1].toString(), proof.pi_b[1][0].toString()],
          ],
          c: [proof.pi_c[0].toString(), proof.pi_c[1].toString()],
        },
        publicInputs: publicSignals.map((signal: any) => signal.toString()),
        metadata,
      };

      logger.info(`Dynamic proof generated for session ${sessionId}`);
      return zkProof;
    } catch (error) {
      logger.error(
        `Failed to generate dynamic proof for session ${sessionId}:`,
        error,
      );
      throw error;
    }
  }

  async verifyProof(proof: ZKProof): Promise<boolean> {
    try {
      let vKey;

      // Try to load verification key from dynamic circuit loader first
      try {
        // Extract template info from circuit ID
        const circuitName = proof.metadata.circuitId;
        if (circuitName.startsWith("generic_")) {
          // This is a dynamic circuit, try to load from dynamic loader
          const templateConfig =
            this.inferTemplateConfigFromCircuitId(circuitName);
          const assets =
            await this.dynamicCircuitLoader.loadCircuitAssets(templateConfig);
          vKey = assets.verificationKey;
          logger.info(
            `Using dynamic circuit verification key for: ${circuitName}`,
          );
        } else {
          // Fall back to legacy loader
          vKey = await this.circuitLoader.loadVerificationKey(
            proof.metadata.circuitId,
          );
          logger.info(
            `Using legacy verification key for: ${proof.metadata.circuitId}`,
          );
        }
      } catch (error) {
        // If dynamic loading fails, try legacy method
        logger.warn(
          `Dynamic verification key loading failed, trying legacy: ${error}`,
        );
        vKey = await this.circuitLoader.loadVerificationKey(
          proof.metadata.circuitId,
        );
      }

      const formattedProof = {
        pi_a: [proof.proof.a[0], proof.proof.a[1], "1"],
        pi_b: [
          [proof.proof.b[0][1], proof.proof.b[0][0]],
          [proof.proof.b[1][1], proof.proof.b[1][0]],
          ["1", "0"],
        ],
        pi_c: [proof.proof.c[0], proof.proof.c[1], "1"],
        protocol: "groth16",
        curve: "bn128",
      };

      const result = await snarkjs.groth16.verify(
        vKey,
        proof.publicInputs,
        formattedProof,
      );

      logger.info(`Proof verification result: ${result}`);
      return result;
    } catch (error) {
      logger.error("Proof verification failed:", error);
      return false;
    }
  }

  /**
   * Legacy method for backward compatibility
   * @deprecated Use generateProof with Template object instead
   */
  async generateLegacyProof(
    sessionId: string,
    templateName: string,
    claim: string,
    extractedData: ExtractedData,
    tlsData: TLSSessionData,
  ): Promise<ZKProof> {
    logger.warn("Using deprecated legacy proof generation method");

    const legacyCircuitName = this.getLegacyCircuitName(templateName, claim);
    const wasm = await this.circuitLoader.loadWasm(legacyCircuitName);
    const zkey = await this.circuitLoader.loadZkey(legacyCircuitName);

    const input = this.inputFormatter.formatInput(
      extractedData,
      tlsData,
      claim,
    );

    const { proof, publicSignals } = await snarkjs.groth16.fullProve(
      input,
      wasm,
      zkey,
    );

    const metadata: ProofMetadata = {
      sessionId,
      template: templateName,
      claim,
      timestamp: Date.now(),
      domain: extractedData.domain,
      circuitId: legacyCircuitName,
    };

    return {
      proof: {
        a: [proof.pi_a[0].toString(), proof.pi_a[1].toString()],
        b: [
          [proof.pi_b[0][1].toString(), proof.pi_b[0][0].toString()],
          [proof.pi_b[1][1].toString(), proof.pi_b[1][0].toString()],
        ],
        c: [proof.pi_c[0].toString(), proof.pi_c[1].toString()],
      },
      publicInputs: publicSignals.map((signal: any) => signal.toString()),
      metadata,
    };
  }

  private getLegacyCircuitName(_template: string, claim: string): string {
    const circuitMap: Record<string, string> = {
      balanceGreaterThan: "balance_check",
      hasMinimumBalance: "balance_check",
      followersGreaterThan: "follower_check",
      isInfluencer: "influencer_check",
      hasVerifiedBadge: "verification_check",
      accountAge: "age_check",
    };

    return circuitMap[claim] || "generic_claim";
  }

  async generateMockProof(
    sessionId: string,
    template: string,
    claim: string,
    domain: string,
  ): Promise<ZKProof> {
    const metadata: ProofMetadata = {
      sessionId,
      template,
      claim,
      timestamp: Date.now(),
      domain,
      circuitId: "mock_circuit",
    };

    return {
      proof: {
        a: ["1", "2"],
        b: [
          ["3", "4"],
          ["5", "6"],
        ],
        c: ["7", "8"],
      },
      publicInputs: ["1", "0"],
      metadata,
    };
  }

  async batchGenerateProofs(
    requests: Array<{
      sessionId: string;
      template: string;
      claim: string;
      extractedData: ExtractedData;
      tlsData: TLSSessionData;
    }>,
  ): Promise<ZKProof[]> {
    const proofs: ZKProof[] = [];

    for (const request of requests) {
      try {
        const proof = await this.generateLegacyProof(
          request.sessionId,
          request.template,
          request.claim,
          request.extractedData,
          request.tlsData,
        );
        proofs.push(proof);
      } catch (error) {
        logger.error(`Failed to generate proof for batch item:`, error);
      }
    }

    return proofs;
  }

  async exportProof(proof: ZKProof): Promise<string> {
    return JSON.stringify(proof, null, 2);
  }

  async importProof(proofData: string): Promise<ZKProof> {
    try {
      return JSON.parse(proofData);
    } catch (error) {
      throw new Error(`Invalid proof data: ${error}`);
    }
  }

  /**
   * Converts CircuitInput to the format expected by snarkjs
   */
  private convertCircuitInputForSnarkjs(circuitInput: CircuitInput): any {
    return {
      dataHash: circuitInput.dataHash,
      claimHash: circuitInput.claimHash,
      templateHash: circuitInput.templateHash,
      threshold: circuitInput.threshold,
      timestamp: circuitInput.timestamp,
      data: circuitInput.data,
      claim: circuitInput.claim,
      dataType: circuitInput.dataType,
      claimType: circuitInput.claimType,
      actualValue: circuitInput.actualValue,
    };
  }

  /**
   * Infers template configuration from circuit ID for verification
   */
  private inferTemplateConfigFromCircuitId(circuitId: string): {
    dataType: "numeric" | "string" | "boolean";
    claimType: "comparison" | "existence" | "pattern";
    maxDataLength: number;
  } {
    // Parse circuit ID format: generic_<dataType>_<claimType>_<maxDataLength>
    const parts = circuitId.split("_");

    if (parts.length >= 4 && parts[0] === "generic") {
      const dataType = parts[1] as "numeric" | "string" | "boolean";
      const claimType = parts[2] as "comparison" | "existence" | "pattern";
      const maxDataLength = parseInt(parts[3]) || 32;

      return { dataType, claimType, maxDataLength };
    }

    // Default fallback
    return {
      dataType: "numeric",
      claimType: "comparison",
      maxDataLength: 32,
    };
  }

  /**
   * Generates a proof with dynamic request configuration
   */
  async generateDynamicProof(request: DynamicProofRequest): Promise<ZKProof> {
    if (typeof request.template === "string") {
      throw new Error(
        "DynamicProofRequest requires Template object, not string",
      );
    }

    // Extract session ID and other parameters from request
    const sessionId = `session_${Date.now()}`;

    // This would normally come from the session context
    const extractedData: ExtractedData = {
      raw: {},
      processed: {},
      timestamp: Date.now(),
      url: `https://${request.template.domain}`,
      domain: request.template.domain,
    };

    const tlsData: TLSSessionData = {
      serverCertificate: "",
      sessionKeys: {
        clientRandom: "0x",
        serverRandom: "0x",
        masterSecret: "0x",
      },
      handshakeMessages: [],
      timestamp: Date.now(),
    };

    return this.generateProof(
      sessionId,
      request.template,
      request.claim,
      extractedData,
      tlsData,
      request.params,
    );
  }

  /**
   * Pre-compiles circuits for known templates to improve performance
   */
  async precompileTemplateCircuits(templates: Template[]): Promise<void> {
    logger.info(`Pre-compiling circuits for ${templates.length} templates...`);

    for (const template of templates) {
      try {
        this.templateCircuitMapper.registerTemplate(template);

        if (template.circuitConfig?.supportedClaims) {
          for (const claim of template.circuitConfig.supportedClaims) {
            const circuitConfig = this.templateCircuitMapper.getCircuitConfig(
              template.domain,
              claim.name,
            );
            if (circuitConfig) {
              await this.dynamicCircuitLoader.loadCircuitAssets(circuitConfig);
              logger.info(
                `Pre-compiled circuit for ${template.name}:${claim.name}`,
              );
            }
          }
        }
      } catch (error) {
        logger.error(
          `Failed to pre-compile circuits for template ${template.name}:`,
          error,
        );
      }
    }

    logger.info("Circuit pre-compilation completed");
  }

  /**
   * Gets supported claims for a template
   */
  getSupportedClaims(template: Template): string[] {
    this.templateCircuitMapper.registerTemplate(template);
    return this.templateCircuitMapper.getSupportedClaims(template.domain);
  }

  /**
   * Validates if a claim is supported by a template
   */
  isClaimSupported(template: Template, claim: string): boolean {
    const supportedClaims = this.getSupportedClaims(template);
    return supportedClaims.includes(claim);
  }

  /**
   * Gets circuit information for a template and claim
   */
  async getCircuitInfo(template: Template, claim: string): Promise<any> {
    this.templateCircuitMapper.registerTemplate(template);

    const circuitConfig = this.templateCircuitMapper.getCircuitConfig(
      template.domain,
      claim,
    );
    if (!circuitConfig) {
      throw new Error(
        `No circuit configuration found for ${template.domain}:${claim}`,
      );
    }

    const assets =
      await this.dynamicCircuitLoader.loadCircuitAssets(circuitConfig);
    return assets.circuitInfo;
  }
}
