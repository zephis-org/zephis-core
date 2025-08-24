import fs from "fs/promises";
import path from "path";
import { CircuitConfig } from "../types";
import logger from "../utils/logger";

export class CircuitLoader {
  private circuits: Map<string, CircuitConfig> = new Map();
  private circuitDir: string;

  constructor(circuitDir?: string) {
    this.circuitDir = circuitDir || path.join(__dirname, "../circuits");
  }

  async loadCircuit(name: string): Promise<CircuitConfig> {
    if (this.circuits.has(name)) {
      return this.circuits.get(name)!;
    }

    try {
      const config: CircuitConfig = {
        name,
        wasmPath: path.join(this.circuitDir, name, `${name}.wasm`),
        zkeyPath: path.join(this.circuitDir, name, `${name}_final.zkey`),
        verificationKeyPath: path.join(
          this.circuitDir,
          name,
          `verification_key.json`,
        ),
      };

      await this.validateCircuitFiles(config);

      this.circuits.set(name, config);
      logger.info(`Circuit loaded: ${name}`);

      return config;
    } catch (error) {
      logger.error(`Failed to load circuit ${name}:`, error);
      throw error;
    }
  }

  private async validateCircuitFiles(config: CircuitConfig): Promise<void> {
    const files = [
      config.wasmPath,
      config.zkeyPath,
      config.verificationKeyPath,
    ];

    for (const file of files) {
      try {
        await fs.access(file);
      } catch {
        throw new Error(`Circuit file not found: ${file}`);
      }
    }
  }

  async loadVerificationKey(circuitName: string): Promise<any> {
    const config = await this.loadCircuit(circuitName);
    const vkData = await fs.readFile(config.verificationKeyPath, "utf-8");
    return JSON.parse(vkData);
  }

  async loadWasm(circuitName: string): Promise<Buffer> {
    const config = await this.loadCircuit(circuitName);
    return await fs.readFile(config.wasmPath);
  }

  async loadZkey(circuitName: string): Promise<Buffer> {
    const config = await this.loadCircuit(circuitName);
    return await fs.readFile(config.zkeyPath);
  }

  getCircuit(name: string): CircuitConfig | undefined {
    return this.circuits.get(name);
  }

  listCircuits(): string[] {
    return Array.from(this.circuits.keys());
  }

  clearCache(): void {
    this.circuits.clear();
  }

  async getCircuitInfo(name: string): Promise<{
    name: string;
    wasmSize: number;
    zkeySize: number;
    constraints?: number;
  }> {
    const config = await this.loadCircuit(name);

    const wasmStats = await fs.stat(config.wasmPath);
    const zkeyStats = await fs.stat(config.zkeyPath);

    return {
      name,
      wasmSize: wasmStats.size,
      zkeySize: zkeyStats.size,
    };
  }
}
