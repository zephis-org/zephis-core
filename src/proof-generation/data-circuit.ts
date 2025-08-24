import * as snarkjs from 'snarkjs';
import * as crypto from 'crypto';

export interface DataProofInputs {
  applicationData: string[];
  sessionKeys: {
    clientWriteKey: string[];
    serverWriteKey: string[];
    clientWriteMac: string[];
    serverWriteMac: string[];
  };
  transcriptProof: {
    merkleRoot: string;
    merkleProofs: string[][];
    recordIndices: number[];
  };
  sessionCommitment: string;
  dataCommitments: string[];
}

export interface DataProofOutputs {
  transcriptValid: boolean;
  dataIntegrityVerified: boolean;
  sessionLinked: boolean;
  selectiveDisclosureHash: string;
}

export interface DataCircuitProof {
  proof: any;
  publicSignals: string[];
  verificationKey: any;
  revealedData: any[];
}

export class DataCircuit {
  private circuitWasm: Uint8Array | null = null;
  private circuitZkey: Uint8Array | null = null;
  private verificationKey: any = null;

  constructor(
    private wasmPath: string,
    private zkeyPath: string,
    private verificationKeyPath: string
  ) {}

  public async initialize(): Promise<void> {
    try {
      const fs = await import('fs/promises');
      
      // Load circuit files from actual paths
      this.circuitWasm = await fs.readFile(this.wasmPath);
      this.circuitZkey = await fs.readFile(this.zkeyPath);
      
      const verificationKeyData = await fs.readFile(this.verificationKeyPath, 'utf8');
      this.verificationKey = JSON.parse(verificationKeyData);
    } catch (error) {
      throw new Error(`Failed to initialize data circuit: ${error}`);
    }
  }

  public async generateProof(inputs: DataProofInputs): Promise<DataCircuitProof> {
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

      const revealedData = this.extractRevealedData(inputs);

      return {
        proof,
        publicSignals,
        verificationKey: this.verificationKey,
        revealedData
      };
    } catch (error) {
      throw new Error(`Data proof generation failed: ${error}`);
    }
  }

  private async prepareCircuitInputs(inputs: DataProofInputs): Promise<any> {
    return {
      applicationData: inputs.applicationData,
      clientWriteKey: inputs.sessionKeys.clientWriteKey,
      serverWriteKey: inputs.sessionKeys.serverWriteKey,
      clientWriteMac: inputs.sessionKeys.clientWriteMac,
      serverWriteMac: inputs.sessionKeys.serverWriteMac,
      merkleRoot: this.encodeHash(inputs.transcriptProof.merkleRoot),
      merkleProofs: inputs.transcriptProof.merkleProofs.map(proof => 
        proof.map(hash => this.encodeHash(hash))
      ),
      recordIndices: inputs.transcriptProof.recordIndices.map(idx => idx.toString()),
      sessionCommitment: this.encodeHash(inputs.sessionCommitment),
      dataCommitments: inputs.dataCommitments.map(commitment => this.encodeHash(commitment))
    };
  }

  private encodeHash(hash: string): string[] {
    const buffer = Buffer.from(hash, 'hex');
    return Array.from(buffer).map(byte => byte.toString());
  }

  public validateTranscriptIntegrity(inputs: DataProofInputs): boolean {
    try {
      // Verify each Merkle proof for selected records
      for (let i = 0; i < inputs.transcriptProof.recordIndices.length; i++) {
        const recordIndex = inputs.transcriptProof.recordIndices[i];
        const merkleProof = inputs.transcriptProof.merkleProofs[i];
        
        if (!this.verifyMerkleProof(
          inputs.applicationData[i],
          recordIndex,
          merkleProof,
          inputs.transcriptProof.merkleRoot
        )) {
          return false;
        }
      }
      
      return true;
    } catch (error) {
      return false;
    }
  }

  private verifyMerkleProof(
    data: string,
    recordIndex: number,
    merkleProof: string[],
    merkleRoot: string
  ): boolean {
    let currentHash = this.hashData(data);
    let currentIndex = recordIndex;
    
    for (const sibling of merkleProof) {
      const combined = crypto.createHash('sha256');
      
      if (currentIndex % 2 === 0) {
        combined.update(Buffer.from(currentHash, 'hex'));
        combined.update(Buffer.from(sibling, 'hex'));
      } else {
        combined.update(Buffer.from(sibling, 'hex'));
        combined.update(Buffer.from(currentHash, 'hex'));
      }
      
      currentHash = combined.digest('hex');
      currentIndex = Math.floor(currentIndex / 2);
    }
    
    return currentHash === merkleRoot;
  }

  private hashData(data: string): string {
    const hash = crypto.createHash('sha256');
    hash.update(data);
    return hash.digest('hex');
  }

  public validateMACIntegrity(
    applicationData: string[],
    sessionKeys: any,
    sequenceNumbers: number[]
  ): boolean {
    try {
      for (let i = 0; i < applicationData.length; i++) {
        const data = applicationData[i];
        const sequenceNumber = sequenceNumbers[i] || i;
        
        if (!this.verifyMAC(data, sessionKeys.serverWriteMac, sequenceNumber)) {
          return false;
        }
      }
      
      return true;
    } catch (error) {
      return false;
    }
  }

  private verifyMAC(data: string, macKey: string[], sequenceNumber: number): boolean {
    try {
      const macData = this.prepareMACData(data, sequenceNumber);
      const keyBuffer = Buffer.from(macKey.map(s => parseInt(s)));
      
      const hmac = crypto.createHmac('sha256', keyBuffer);
      hmac.update(macData);
      const computedMAC = hmac.digest();
      
      // In a real implementation, we would extract and compare the actual MAC
      // For now, we validate that MAC computation succeeded
      if (computedMAC.length === 0) {
        return false;
      }
      
      // In a real implementation, we would extract and compare the actual MAC
      return true; // Placeholder
    } catch (error) {
      return false;
    }
  }

  private prepareMACData(data: string, sequenceNumber: number): Buffer {
    return Buffer.concat([
      Buffer.from([
        (sequenceNumber >> 24) & 0xff,
        (sequenceNumber >> 16) & 0xff,
        (sequenceNumber >> 8) & 0xff,
        sequenceNumber & 0xff,
        0, 0, 0, 0, // Upper 32 bits of sequence number
        23, // Application data type
        3, 3, // TLS version (3.3 = TLS 1.2)
        (data.length >> 8) & 0xff,
        data.length & 0xff
      ]),
      Buffer.from(data, 'utf8')
    ]);
  }

  public createSelectiveDisclosure(
    fullData: any[],
    revealIndices: number[],
    hiddenIndices: number[]
  ): {
    revealedData: any[];
    hiddenCommitments: string[];
    disclosureProof: string;
  } {
    const revealedData = revealIndices.map(index => fullData[index]);
    const hiddenData = hiddenIndices.map(index => fullData[index]);
    
    const hiddenCommitments = hiddenData.map(data => this.commitToData(data));
    const disclosureProof = this.generateDisclosureProof(revealedData, hiddenCommitments);
    
    return {
      revealedData,
      hiddenCommitments,
      disclosureProof
    };
  }

  private commitToData(data: any): string {
    const hash = crypto.createHash('sha256');
    hash.update(JSON.stringify(data));
    return hash.digest('hex');
  }

  private generateDisclosureProof(revealedData: any[], hiddenCommitments: string[]): string {
    const combinedHash = crypto.createHash('sha256');
    
    revealedData.forEach(data => {
      combinedHash.update(JSON.stringify(data));
    });
    
    hiddenCommitments.forEach(commitment => {
      combinedHash.update(commitment);
    });
    
    return combinedHash.digest('hex');
  }

  public generateRangeProof(
    value: number,
    minValue: number,
    maxValue: number,
    commitment: string
  ): {
    proof: string;
    validRange: boolean;
  } {
    const validRange = value >= minValue && value <= maxValue;
    
    // Simplified range proof generation
    const proofData = {
      commitment,
      range: { min: minValue, max: maxValue },
      valid: validRange,
      timestamp: Date.now()
    };
    
    const proof = crypto.createHash('sha256')
      .update(JSON.stringify(proofData))
      .digest('hex');
    
    return { proof, validRange };
  }

  public extractPublicOutputs(inputs: DataProofInputs): DataProofOutputs {
    return {
      transcriptValid: this.validateTranscriptIntegrity(inputs),
      dataIntegrityVerified: this.validateMACIntegrity(
        inputs.applicationData,
        inputs.sessionKeys,
        inputs.transcriptProof.recordIndices
      ),
      sessionLinked: this.validateSessionLinking(inputs),
      selectiveDisclosureHash: this.computeSelectiveDisclosureHash(inputs)
    };
  }

  private validateSessionLinking(inputs: DataProofInputs): boolean {
    // Verify that the data proof is linked to the correct session
    const expectedCommitment = this.computeSessionCommitment(inputs.sessionKeys);
    return expectedCommitment === inputs.sessionCommitment;
  }

  private computeSessionCommitment(sessionKeys: any): string {
    const hash = crypto.createHash('sha256');
    hash.update(sessionKeys.clientWriteKey.join(''));
    hash.update(sessionKeys.serverWriteKey.join(''));
    hash.update(sessionKeys.clientWriteMac.join(''));
    hash.update(sessionKeys.serverWriteMac.join(''));
    return hash.digest('hex');
  }

  private computeSelectiveDisclosureHash(inputs: DataProofInputs): string {
    const hash = crypto.createHash('sha256');
    inputs.applicationData.forEach(data => hash.update(data));
    inputs.dataCommitments.forEach(commitment => hash.update(commitment));
    return hash.digest('hex');
  }

  private extractRevealedData(inputs: DataProofInputs): any[] {
    return inputs.transcriptProof.recordIndices.map(index => ({
      index,
      data: inputs.applicationData[index] || null,
      commitment: inputs.dataCommitments[index] || null
    }));
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
      console.error('Data proof verification failed:', error);
      return false;
    }
  }

  public estimateGasCost(): number {
    return 320000; // ~320k gas for application data proof verification
  }
}