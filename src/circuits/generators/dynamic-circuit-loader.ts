import { promises as fs } from "fs";
import * as path from "path";
import logger from "../../utils/logger";
import { TemplateCircuitConfig } from "./circuit-mapper";

export interface CircuitAssets {
  wasm: Buffer;
  zkey: Buffer;
  verificationKey: any;
  circuitInfo: CircuitInfo;
}

export interface CircuitInfo {
  name: string;
  maxDataLength: number;
  maxClaimLength: number;
  version: string;
  compiled: Date;
  templateSupport: string[];
}

export class DynamicCircuitLoader {
  private circuitsPath: string;
  private buildPath: string;
  private circuitCache: Map<string, CircuitAssets> = new Map();

  constructor(circuitsPath?: string) {
    this.circuitsPath = circuitsPath || path.join(__dirname, "..");
    this.buildPath = path.join(this.circuitsPath, "build");
  }

  /**
   * Loads circuit assets dynamically based on template configuration
   */
  async loadCircuitAssets(
    templateConfig: TemplateCircuitConfig,
    circuitName?: string,
  ): Promise<CircuitAssets> {
    const effectiveCircuitName =
      circuitName || this.determineCircuitName(templateConfig);

    logger.info(`Loading circuit assets for: ${effectiveCircuitName}`);

    // Check cache first
    if (this.circuitCache.has(effectiveCircuitName)) {
      logger.info(`Circuit ${effectiveCircuitName} loaded from cache`);
      return this.circuitCache.get(effectiveCircuitName)!;
    }

    try {
      // Ensure the generic circuit is compiled
      await this.ensureCircuitCompiled(effectiveCircuitName, templateConfig);

      // Load all required assets
      const assets = await this.loadAssets(effectiveCircuitName);

      // Cache the loaded assets
      this.circuitCache.set(effectiveCircuitName, assets);

      logger.info(
        `Circuit assets loaded successfully for: ${effectiveCircuitName}`,
      );
      return assets;
    } catch (error) {
      logger.error(
        `Failed to load circuit assets for ${effectiveCircuitName}:`,
        error,
      );
      throw error;
    }
  }

  /**
   * Ensures the circuit is compiled with the correct parameters
   */
  private async ensureCircuitCompiled(
    circuitName: string,
    templateConfig: TemplateCircuitConfig,
  ): Promise<void> {
    const buildDir = path.join(this.buildPath, circuitName);
    const wasmPath = path.join(buildDir, `${circuitName}.wasm`);
    const zkeyPath = path.join(buildDir, `${circuitName}.zkey`);

    // Check if compiled assets exist
    const wasmExists = await this.fileExists(wasmPath);
    const zkeyExists = await this.fileExists(zkeyPath);

    if (!wasmExists || !zkeyExists) {
      logger.info(`Compiling circuit: ${circuitName}`);
      await this.compileCircuit(circuitName, templateConfig);
    } else {
      // Check if recompilation is needed (circuit source newer than build)
      const sourceModified = await this.getSourceModificationTime();
      const buildModified = await this.getBuildModificationTime(wasmPath);

      if (sourceModified > buildModified) {
        logger.info(
          `Recompiling circuit due to source changes: ${circuitName}`,
        );
        await this.compileCircuit(circuitName, templateConfig);
      }
    }
  }

  /**
   * Compiles the generic circuit with template-specific parameters
   */
  private async compileCircuit(
    circuitName: string,
    templateConfig: TemplateCircuitConfig,
  ): Promise<void> {
    const buildDir = path.join(this.buildPath, circuitName);
    await fs.mkdir(buildDir, { recursive: true });

    try {
      // Step 1: Compile circom to r1cs and wasm
      await this.runCircomCompile(circuitName, templateConfig, buildDir);

      // Step 2: Generate witness (powers of tau ceremony)
      await this.generateWitness(circuitName, buildDir);

      // Step 3: Setup phase - generate proving and verification keys
      await this.setupPhase(circuitName, buildDir);

      logger.info(`Circuit compilation completed: ${circuitName}`);
    } catch (error) {
      logger.error(`Circuit compilation failed for ${circuitName}:`, error);
      throw new Error(`Failed to compile circuit: ${error}`);
    }
  }

  /**
   * Runs circom compilation
   */
  private async runCircomCompile(
    circuitName: string,
    templateConfig: TemplateCircuitConfig,
    buildDir: string,
  ): Promise<void> {
    const { exec } = require("child_process");
    const { promisify } = require("util");
    const execAsync = promisify(exec);

    // Circuit path reference for future use
    //     const _circuitPath = path.join(
    //       this.circuitsPath,
    //       "core",
    //       "generic_proof.circom",
    //     );
    const outputDir = buildDir;

    // Create a template-specific circom file with proper instantiation
    const templateCircuitContent =
      await this.generateTemplateSpecificCircuit(templateConfig);
    const templateCircuitPath = path.join(buildDir, `${circuitName}.circom`);
    await fs.writeFile(templateCircuitPath, templateCircuitContent);

    const command = `circom ${templateCircuitPath} --r1cs --wasm --sym -o ${outputDir}`;

    logger.info(`Running circom compilation: ${command}`);
    const { stdout, stderr } = await execAsync(command);

    if (stderr) {
      logger.warn(`Circom compilation warnings: ${stderr}`);
    }

    logger.info(`Circom compilation output: ${stdout}`);
  }

  /**
   * Generates a template-specific circuit file
   */
  private async generateTemplateSpecificCircuit(
    templateConfig: TemplateCircuitConfig,
  ): Promise<string> {
    const baseCircuitPath = path.join(
      this.circuitsPath,
      "core",
      "generic_proof.circom",
    );
    const baseContent = await fs.readFile(baseCircuitPath, "utf8");

    // Replace the main component instantiation with template-specific parameters
    const maxDataLength = templateConfig.maxDataLength || 32;
    const maxClaimLength = 16; // Fixed for now

    // Remove the default main component and add template-specific one
    const modifiedContent = baseContent.replace(
      /component main = GenericProof\(\d+, \d+\);/,
      `component main = GenericProof(${maxDataLength}, ${maxClaimLength});`,
    );

    return modifiedContent;
  }

  /**
   * Generates witness using snarkjs
   */
  private async generateWitness(
    circuitName: string,
    _buildDir: string,
  ): Promise<void> {
    // For now, we'll skip witness generation in the build process
    // Witness generation happens at proof time with actual inputs
    logger.info(`Witness generation setup completed for: ${circuitName}`);
  }

  /**
   * Performs the trusted setup phase
   */
  private async setupPhase(
    circuitName: string,
    buildDir: string,
  ): Promise<void> {
    const { exec } = require("child_process");
    const { promisify } = require("util");
    const execAsync = promisify(exec);

    const r1csPath = path.join(buildDir, `${circuitName}.r1cs`);
    const zkeyPath = path.join(buildDir, `${circuitName}.zkey`);
    const vkeyPath = path.join(buildDir, `verification_key.json`);

    try {
      // Use a universal ceremony file or generate one for testing
      const ptauPath = await this.ensurePowerOfTauFile();

      // Phase 1: Initial setup
      logger.info("Running setup phase 1...");
      await execAsync(
        `snarkjs groth16 setup ${r1csPath} ${ptauPath} ${zkeyPath.replace(".zkey", "_0000.zkey")}`,
      );

      // Phase 2: Contribution (automated for development)
      logger.info("Running setup phase 2...");
      await execAsync(
        `snarkjs zkey contribute ${zkeyPath.replace(".zkey", "_0000.zkey")} ${zkeyPath} --name="contribution" -v`,
      );

      // Export verification key
      logger.info("Exporting verification key...");
      await execAsync(
        `snarkjs zkey export verificationkey ${zkeyPath} ${vkeyPath}`,
      );

      // Clean up intermediate files
      await fs.unlink(zkeyPath.replace(".zkey", "_0000.zkey")).catch(() => {});

      logger.info(`Setup phase completed for: ${circuitName}`);
    } catch (error) {
      logger.error(`Setup phase failed for ${circuitName}:`, error);
      throw error;
    }
  }

  /**
   * Ensures a powers of tau file exists for the trusted setup
   */
  private async ensurePowerOfTauFile(): Promise<string> {
    const ptauPath = path.join(this.buildPath, "pot12_final.ptau");

    if (!(await this.fileExists(ptauPath))) {
      logger.info("Downloading powers of tau file...");

      // For development, we can use a smaller ceremony file
      // In production, you should use a proper ceremony file
      const { exec } = require("child_process");
      const { promisify } = require("util");
      const execAsync = promisify(exec);

      try {
        // Download a small powers of tau file for development
        await execAsync(
          `wget -O ${ptauPath} https://hermez.s3-eu-west-1.amazonaws.com/powersOfTau28_hez_final_12.ptau`,
        );
      } catch (_error) {
        logger.warn(
          "Failed to download ptau file, generating a small one for testing...",
        );
        // Generate a small ptau file for testing purposes
        await execAsync(
          `snarkjs powersoftau new bn128 12 ${ptauPath.replace("_final", "_0000")} -v`,
        );
        await execAsync(
          `snarkjs powersoftau contribute ${ptauPath.replace("_final", "_0000")} ${ptauPath} --name="contribution" -v`,
        );
        await fs.unlink(ptauPath.replace("_final", "_0000")).catch(() => {});
      }
    }

    return ptauPath;
  }

  /**
   * Loads all circuit assets from the build directory
   */
  private async loadAssets(circuitName: string): Promise<CircuitAssets> {
    const buildDir = path.join(this.buildPath, circuitName);

    const wasmPath = path.join(buildDir, `${circuitName}.wasm`);
    const zkeyPath = path.join(buildDir, `${circuitName}.zkey`);
    const vkeyPath = path.join(buildDir, "verification_key.json");
    const infoPath = path.join(buildDir, "circuit_info.json");

    try {
      const [wasm, zkey, vkeyData, circuitInfo] = await Promise.all([
        fs.readFile(wasmPath),
        fs.readFile(zkeyPath),
        fs.readFile(vkeyPath, "utf8").then(JSON.parse),
        this.loadCircuitInfo(infoPath, circuitName),
      ]);

      return {
        wasm,
        zkey,
        verificationKey: vkeyData,
        circuitInfo,
      };
    } catch (error) {
      logger.error(`Failed to load circuit assets from ${buildDir}:`, error);
      throw error;
    }
  }

  /**
   * Loads or generates circuit info
   */
  private async loadCircuitInfo(
    infoPath: string,
    circuitName: string,
  ): Promise<CircuitInfo> {
    try {
      const infoData = await fs.readFile(infoPath, "utf8");
      return JSON.parse(infoData);
    } catch (_error) {
      // Generate default circuit info if file doesn't exist
      const defaultInfo: CircuitInfo = {
        name: circuitName,
        maxDataLength: 32,
        maxClaimLength: 16,
        version: "1.0.0",
        compiled: new Date(),
        templateSupport: ["generic"],
      };

      // Save the info for next time
      await fs.writeFile(infoPath, JSON.stringify(defaultInfo, null, 2));
      return defaultInfo;
    }
  }

  /**
   * Determines the appropriate circuit name based on template configuration
   */
  private determineCircuitName(templateConfig: TemplateCircuitConfig): string {
    // For now, we use the generic circuit for all templates
    // In the future, this could be made more sophisticated
    const { dataType, claimType, maxDataLength } = templateConfig;

    return `generic_${dataType}_${claimType}_${maxDataLength}`;
  }

  /**
   * Utility function to check if file exists
   */
  private async fileExists(filePath: string): Promise<boolean> {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Gets the modification time of the source circuit
   */
  private async getSourceModificationTime(): Promise<Date> {
    const sourcePath = path.join(
      this.circuitsPath,
      "core",
      "generic_proof.circom",
    );
    try {
      const stats = await fs.stat(sourcePath);
      return stats.mtime;
    } catch (_error) {
      return new Date(0); // Return epoch if source doesn't exist
    }
  }

  /**
   * Gets the modification time of a build file
   */
  private async getBuildModificationTime(buildFilePath: string): Promise<Date> {
    try {
      const stats = await fs.stat(buildFilePath);
      return stats.mtime;
    } catch (_error) {
      return new Date(0); // Return epoch if build doesn't exist
    }
  }

  /**
   * Clears the circuit cache
   */
  clearCache(): void {
    this.circuitCache.clear();
    logger.info("Circuit cache cleared");
  }

  /**
   * Gets cached circuit names
   */
  getCachedCircuits(): string[] {
    return Array.from(this.circuitCache.keys());
  }

  /**
   * Pre-compiles circuits for known templates
   */
  async precompileCommonCircuits(): Promise<void> {
    const commonConfigs: TemplateCircuitConfig[] = [
      { dataType: "numeric", claimType: "comparison", maxDataLength: 32 },
      { dataType: "boolean", claimType: "existence", maxDataLength: 16 },
      { dataType: "string", claimType: "pattern", maxDataLength: 64 },
    ];

    logger.info("Pre-compiling common circuits...");

    for (const config of commonConfigs) {
      try {
        await this.loadCircuitAssets(config);
        logger.info(
          `Pre-compiled circuit: ${this.determineCircuitName(config)}`,
        );
      } catch (error) {
        logger.error(`Failed to pre-compile circuit:`, error);
      }
    }

    logger.info("Pre-compilation completed");
  }
}
