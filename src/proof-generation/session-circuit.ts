import * as snarkjs from 'snarkjs';
import * as crypto from 'crypto';
import { HKDF } from '../cryptography/hkdf';
import { PoseidonHasher } from '../cryptography/poseidon';

export interface SessionProofInputs {
  masterSecret: string[];
  sessionKeys: {
    clientWriteKey: string[];
    serverWriteKey: string[];
    clientWriteIV: string[];
    serverWriteIV: string[];
    clientWriteMac: string[];
    serverWriteMac: string[];
  };
  keyDerivationParams: {
    clientRandom: string[];
    serverRandom: string[];
    cipherSuite: string;
  };
  keyCommitment: string;
}

export interface SessionProofOutputs {
  keyCommitmentValid: boolean;
  derivationCorrect: boolean;
  sessionIntegrityHash: string;
}

export interface SessionCircuitProof {
  proof: any;
  publicSignals: string[];
  verificationKey: any;
  keyCommitment: string;
}

export class SessionCircuit {
  private circuitWasm: Uint8Array | null = null;
  private circuitZkey: Uint8Array | null = null;
  private verificationKey: any = null;
  private readonly hkdf: HKDF;
  private readonly poseidonHasher: PoseidonHasher;

  constructor(
    private wasmPath: string,
    private zkeyPath: string,
    private verificationKeyPath: string
  ) {
    this.hkdf = new HKDF();
    this.poseidonHasher = new PoseidonHasher();
  }

  public async initialize(): Promise<void> {
    try {
      const fs = await import('fs/promises');
      
      // Load circuit files from actual paths
      this.circuitWasm = await fs.readFile(this.wasmPath);
      this.circuitZkey = await fs.readFile(this.zkeyPath);
      
      const verificationKeyData = await fs.readFile(this.verificationKeyPath, 'utf8');
      this.verificationKey = JSON.parse(verificationKeyData);
    } catch (error) {
      throw new Error(`Failed to initialize session circuit: ${error}`);
    }
  }

  public async generateProof(inputs: SessionProofInputs): Promise<SessionCircuitProof> {
    if (!this.circuitWasm || !this.circuitZkey) {
      throw new Error('Circuit not initialized');
    }

    try {
      const circuitInputs = await this.prepareCircuitInputs(inputs);
      
      const { proof, publicSignals } = await snarkjs.groth16.fullProve(
        circuitInputs,
        this.wasmPath,
        this.zkeyPath
      );

      return {
        proof,
        publicSignals,
        verificationKey: this.verificationKey,
        keyCommitment: inputs.keyCommitment
      };
    } catch (error) {
      throw new Error(`Session proof generation failed: ${error}`);
    }
  }

  private async prepareCircuitInputs(inputs: SessionProofInputs): Promise<any> {
    return {
      masterSecret: inputs.masterSecret,
      clientWriteKey: inputs.sessionKeys.clientWriteKey,
      serverWriteKey: inputs.sessionKeys.serverWriteKey,
      clientWriteIV: inputs.sessionKeys.clientWriteIV,
      serverWriteIV: inputs.sessionKeys.serverWriteIV,
      clientWriteMac: inputs.sessionKeys.clientWriteMac,
      serverWriteMac: inputs.sessionKeys.serverWriteMac,
      clientRandom: inputs.keyDerivationParams.clientRandom,
      serverRandom: inputs.keyDerivationParams.serverRandom,
      cipherSuite: this.encodeCipherSuite(inputs.keyDerivationParams.cipherSuite),
      keyCommitment: this.encodeCommitment(inputs.keyCommitment)
    };
  }

  private encodeCipherSuite(cipherSuite: string): string[] {
    const encoder = new TextEncoder();
    const encoded = encoder.encode(cipherSuite);
    return Array.from(encoded).map(byte => byte.toString());
  }

  private encodeCommitment(commitment: string): string[] {
    const buffer = Buffer.from(commitment, 'hex');
    return Array.from(buffer).map(byte => byte.toString());
  }

  public validateKeyDerivation(inputs: SessionProofInputs): boolean {
    try {
      // Validate HKDF key derivation process
      const derivedKeys = this.simulateKeyDerivation(
        inputs.masterSecret,
        inputs.keyDerivationParams.clientRandom,
        inputs.keyDerivationParams.serverRandom,
        inputs.keyDerivationParams.cipherSuite
      );

      return this.verifyDerivedKeys(derivedKeys, inputs.sessionKeys);
    } catch (error) {
      return false;
    }
  }

  private simulateKeyDerivation(
    masterSecret: string[],
    clientRandom: string[],
    serverRandom: string[],
    cipherSuite: string
  ): any {
    // Convert strings to buffers for HKDF
    const masterSecretBuffer = Buffer.from(masterSecret.map(s => parseInt(s)));
    const clientRandomBuffer = Buffer.from(clientRandom.map(s => parseInt(s)));
    const serverRandomBuffer = Buffer.from(serverRandom.map(s => parseInt(s)));
    
    const keyBlockSize = this.getKeyBlockSize(cipherSuite);
    const keyBlock = this.hkdf.deriveTLSKeys(
      masterSecretBuffer,
      clientRandomBuffer,
      serverRandomBuffer,
      keyBlockSize
    );
    
    // Convert back to string array format
    const keyBlockArray = Array.from(keyBlock).map(byte => byte.toString());
    return this.splitKeyBlock(keyBlockArray, cipherSuite);
  }


  private getKeyBlockSize(cipherSuite: string): number {
    const sizes: Record<string, number> = {
      'TLS_RSA_WITH_AES_128_CBC_SHA': 104,
      'TLS_RSA_WITH_AES_256_CBC_SHA': 136,
      'TLS_RSA_WITH_AES_128_CBC_SHA256': 104,
      'TLS_RSA_WITH_AES_256_CBC_SHA256': 136,
      'TLS_RSA_WITH_AES_128_GCM_SHA256': 80,
      'TLS_RSA_WITH_AES_256_GCM_SHA384': 112
    };
    return sizes[cipherSuite] || 136;
  }

  private splitKeyBlock(keyBlock: string[], cipherSuite: string): any {
    let offset = 0;
    
    const macKeySize = this.getMacKeySize(cipherSuite);
    const encKeySize = this.getEncKeySize(cipherSuite);
    const ivSize = this.getIVSize(cipherSuite);
    
    return {
      clientWriteMac: keyBlock.slice(offset, offset + macKeySize),
      serverWriteMac: keyBlock.slice(offset + macKeySize, offset + 2 * macKeySize),
      clientWriteKey: keyBlock.slice(offset + 2 * macKeySize, offset + 2 * macKeySize + encKeySize),
      serverWriteKey: keyBlock.slice(offset + 2 * macKeySize + encKeySize, offset + 2 * macKeySize + 2 * encKeySize),
      clientWriteIV: keyBlock.slice(offset + 2 * macKeySize + 2 * encKeySize, offset + 2 * macKeySize + 2 * encKeySize + ivSize),
      serverWriteIV: keyBlock.slice(offset + 2 * macKeySize + 2 * encKeySize + ivSize, offset + 2 * macKeySize + 2 * encKeySize + 2 * ivSize)
    };
  }

  private getMacKeySize(cipherSuite: string): number {
    if (cipherSuite.includes('GCM')) return 0;
    if (cipherSuite.includes('SHA256') || cipherSuite.includes('SHA384')) return 32;
    return 20;
  }

  private getEncKeySize(cipherSuite: string): number {
    if (cipherSuite.includes('AES_256')) return 32;
    return 16;
  }

  private getIVSize(cipherSuite: string): number {
    if (cipherSuite.includes('GCM')) return 4;
    return 16;
  }

  private verifyDerivedKeys(derivedKeys: any, expectedKeys: any): boolean {
    return (
      this.arraysEqual(derivedKeys.clientWriteKey, expectedKeys.clientWriteKey) &&
      this.arraysEqual(derivedKeys.serverWriteKey, expectedKeys.serverWriteKey) &&
      this.arraysEqual(derivedKeys.clientWriteIV, expectedKeys.clientWriteIV) &&
      this.arraysEqual(derivedKeys.serverWriteIV, expectedKeys.serverWriteIV) &&
      this.arraysEqual(derivedKeys.clientWriteMac, expectedKeys.clientWriteMac) &&
      this.arraysEqual(derivedKeys.serverWriteMac, expectedKeys.serverWriteMac)
    );
  }

  private arraysEqual(a: string[], b: string[]): boolean {
    if (a.length !== b.length) return false;
    return a.every((val, index) => val === b[index]);
  }

  public validateKeyCommitment(inputs: SessionProofInputs): boolean {
    try {
      const computedCommitment = this.computeKeyCommitment(inputs.sessionKeys);
      return computedCommitment === inputs.keyCommitment;
    } catch (error) {
      return false;
    }
  }

  private computeKeyCommitment(sessionKeys: any): string {
    // Use Poseidon hash for efficiency in ZK circuits
    const keyElements = [
      sessionKeys.clientWriteKey.join(''),
      sessionKeys.serverWriteKey.join(''),
      sessionKeys.clientWriteIV.join(''),
      sessionKeys.serverWriteIV.join(''),
      sessionKeys.clientWriteMac.join(''),
      sessionKeys.serverWriteMac.join('')
    ];
    
    return this.poseidonHasher.hashStrings(keyElements);
  }

  public extractPublicOutputs(inputs: SessionProofInputs): SessionProofOutputs {
    return {
      keyCommitmentValid: this.validateKeyCommitment(inputs),
      derivationCorrect: this.validateKeyDerivation(inputs),
      sessionIntegrityHash: this.computeSessionIntegrityHash(inputs)
    };
  }

  private computeSessionIntegrityHash(inputs: SessionProofInputs): string {
    const hash = crypto.createHash('sha256');
    hash.update(inputs.masterSecret.join(''));
    hash.update(inputs.keyCommitment);
    hash.update(inputs.keyDerivationParams.cipherSuite);
    return hash.digest('hex');
  }

  public async verifyProof(
    proof: any,
    publicSignals: string[],
    verificationKey?: any
  ): Promise<boolean> {
    try {
      const vKey = verificationKey || this.verificationKey;
      return await snarkjs.groth16.verify(vKey, publicSignals, proof);
    } catch (error) {
      console.error('Session proof verification failed:', error);
      return false;
    }
  }

  public estimateGasCost(): number {
    // Estimated gas cost for session key proof verification
    return 280000; // ~280k gas for session proof verification
  }

  public generateKeyCommitment(sessionKeys: any): string {
    return this.computeKeyCommitment(sessionKeys);
  }
}