import { encodeFunctionData } from 'viem';

export interface ProofBundle {
  handshakeProof: {
    proof: any;
    publicInputs: string[];
    verificationKey: any;
  };
  sessionProof: {
    proof: any;
    publicInputs: string[];
    verificationKey: any;
  };
  dataProof: {
    proof: any;
    publicInputs: string[];
    verificationKey: any;
  };
  metadata: {
    sessionId: string;
    timestamp: number;
    gasEstimate: number;
  };
}

export interface BatchProofBundle {
  proofs: ProofBundle[];
  batchCommitment: string;
  merkleRoot: string;
  totalGasEstimate: number;
}

export class ProofBundler {
  private readonly MAX_BATCH_SIZE = 10;
  private readonly GAS_BUFFER = 50000;

  constructor() {}

  public createProofBundle(
    handshakeProof: any,
    sessionProof: any,
    dataProof: any,
    sessionId: string
  ): ProofBundle {
    const gasEstimate = this.estimateBundleGas(handshakeProof, sessionProof, dataProof);

    return {
      handshakeProof: {
        proof: handshakeProof.proof,
        publicInputs: handshakeProof.publicSignals,
        verificationKey: handshakeProof.verificationKey
      },
      sessionProof: {
        proof: sessionProof.proof,
        publicInputs: sessionProof.publicSignals,
        verificationKey: sessionProof.verificationKey
      },
      dataProof: {
        proof: dataProof.proof,
        publicInputs: dataProof.publicSignals,
        verificationKey: dataProof.verificationKey
      },
      metadata: {
        sessionId,
        timestamp: Date.now(),
        gasEstimate
      }
    };
  }

  private estimateBundleGas(handshakeProof: any, sessionProof: any, dataProof: any): number {
    // Base gas costs for Groth16 verification on Ethereum
    const handshakeGas = 250000;
    const sessionGas = 280000;
    const dataGas = 320000;
    
    // Add gas for public input processing
    const publicInputGas = (
      (handshakeProof.publicInputs || handshakeProof.publicSignals || []).length +
      (sessionProof.publicInputs || sessionProof.publicSignals || []).length +
      (dataProof.publicInputs || dataProof.publicSignals || []).length
    ) * 3000;

    return handshakeGas + sessionGas + dataGas + publicInputGas + this.GAS_BUFFER;
  }

  public createBatchBundle(proofBundles: ProofBundle[]): BatchProofBundle {
    if (proofBundles.length === 0) {
      throw new Error('Cannot create batch bundle from empty array');
    }

    if (proofBundles.length > this.MAX_BATCH_SIZE) {
      throw new Error(`Batch size exceeds maximum of ${this.MAX_BATCH_SIZE}`);
    }

    const batchCommitment = this.generateBatchCommitment(proofBundles);
    const merkleRoot = this.generateBatchMerkleRoot(proofBundles);
    const totalGasEstimate = this.calculateBatchGasEstimate(proofBundles);

    return {
      proofs: proofBundles,
      batchCommitment,
      merkleRoot,
      totalGasEstimate
    };
  }

  private generateBatchCommitment(proofBundles: ProofBundle[]): string {
    const concatenatedData = proofBundles.map(bundle => {
      return JSON.stringify({
        sessionId: bundle.metadata.sessionId,
        handshakeHash: this.hashProof(bundle.handshakeProof.proof),
        sessionHash: this.hashProof(bundle.sessionProof.proof),
        dataHash: this.hashProof(bundle.dataProof.proof)
      });
    }).join('');

    return this.keccak256(concatenatedData);
  }

  private generateBatchMerkleRoot(proofBundles: ProofBundle[]): string {
    const proofHashes = proofBundles.map(bundle => {
      const bundleHash = this.keccak256(JSON.stringify({
        handshake: this.hashProof(bundle.handshakeProof.proof),
        session: this.hashProof(bundle.sessionProof.proof),
        data: this.hashProof(bundle.dataProof.proof),
        sessionId: bundle.metadata.sessionId
      }));
      return bundleHash;
    });

    return this.buildMerkleRoot(proofHashes);
  }

  private hashProof(proof: any): string {
    return this.keccak256(JSON.stringify(proof));
  }

  private keccak256(data: string): string {
    // Using a simplified hash - in real implementation use proper keccak256
    const crypto = require('crypto');
    return crypto.createHash('sha256').update(data).digest('hex');
  }

  private buildMerkleRoot(hashes: string[]): string {
    if (hashes.length === 0) return '';
    if (hashes.length === 1) return hashes[0];

    let currentLevel = hashes;

    while (currentLevel.length > 1) {
      const nextLevel: string[] = [];

      for (let i = 0; i < currentLevel.length; i += 2) {
        const left = currentLevel[i];
        const right = i + 1 < currentLevel.length ? currentLevel[i + 1] : left;
        nextLevel.push(this.keccak256(left + right));
      }

      currentLevel = nextLevel;
    }

    return currentLevel[0];
  }

  private calculateBatchGasEstimate(proofBundles: ProofBundle[]): number {
    const individualGasTotal = proofBundles.reduce(
      (sum, bundle) => sum + bundle.metadata.gasEstimate,
      0
    );

    // Batch verification savings (approximately 15% reduction)
    const batchSavings = Math.floor(individualGasTotal * 0.15);
    
    // Add overhead for batch processing - scale with batch size but cap it
    const batchOverhead = Math.min(30000 + (proofBundles.length * 3000), 50000);

    return Math.max(individualGasTotal - batchSavings + batchOverhead, 200000);
  }

  public encodeProofForContract(proofBundle: ProofBundle): {
    handshakeCalldata: `0x${string}`;
    sessionCalldata: `0x${string}`;
    dataCalldata: `0x${string}`;
  } {
    const handshakeCalldata = encodeFunctionData({
      abi: [{
        name: 'verifyHandshakeProof',
        type: 'function',
        inputs: [
          { name: 'proof', type: 'uint256[8]' },
          { name: 'publicInputs', type: 'uint256[]' }
        ]
      }],
      functionName: 'verifyHandshakeProof',
      args: [
        this.formatGrothProof(proofBundle.handshakeProof.proof),
        this.formatPublicInputs(proofBundle.handshakeProof.publicInputs)
      ]
    });

    const sessionCalldata = encodeFunctionData({
      abi: [{
        name: 'verifySessionProof',
        type: 'function',
        inputs: [
          { name: 'proof', type: 'uint256[8]' },
          { name: 'publicInputs', type: 'uint256[]' }
        ]
      }],
      functionName: 'verifySessionProof',
      args: [
        this.formatGrothProof(proofBundle.sessionProof.proof),
        this.formatPublicInputs(proofBundle.sessionProof.publicInputs)
      ]
    });

    const dataCalldata = encodeFunctionData({
      abi: [{
        name: 'verifyDataProof',
        type: 'function',
        inputs: [
          { name: 'proof', type: 'uint256[8]' },
          { name: 'publicInputs', type: 'uint256[]' }
        ]
      }],
      functionName: 'verifyDataProof',
      args: [
        this.formatGrothProof(proofBundle.dataProof.proof),
        this.formatPublicInputs(proofBundle.dataProof.publicInputs)
      ]
    });

    return {
      handshakeCalldata,
      sessionCalldata,
      dataCalldata
    };
  }

  public encodeBatchProofForContract(batchBundle: BatchProofBundle): `0x${string}` {
    const proofData = batchBundle.proofs.map(bundle => ({
      handshakeProof: this.formatGrothProof(bundle.handshakeProof.proof),
      sessionProof: this.formatGrothProof(bundle.sessionProof.proof),
      dataProof: this.formatGrothProof(bundle.dataProof.proof),
      handshakeInputs: this.formatPublicInputs(bundle.handshakeProof.publicInputs),
      sessionInputs: this.formatPublicInputs(bundle.sessionProof.publicInputs),
      dataInputs: this.formatPublicInputs(bundle.dataProof.publicInputs),
      sessionId: bundle.metadata.sessionId
    }));

    return encodeFunctionData({
      abi: [{
        name: 'verifyBatchProofs',
        type: 'function',
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
        ]
      }],
      functionName: 'verifyBatchProofs',
      args: [
        proofData,
        `0x${batchBundle.batchCommitment}` as `0x${string}`,
        `0x${batchBundle.merkleRoot}` as `0x${string}`
      ]
    });
  }

  private formatGrothProof(proof: any): bigint[] {
    // Convert Groth16 proof to uint256[8] format expected by contracts
    const toBigInt = (val: any) => {
      if (typeof val === 'number') {
        return BigInt(Math.floor(val));
      }
      return BigInt(val || 0);
    };
    
    return [
      toBigInt(proof.pi_a?.[0]),
      toBigInt(proof.pi_a?.[1]),
      toBigInt(proof.pi_b?.[0]?.[1]),
      toBigInt(proof.pi_b?.[0]?.[0]),
      toBigInt(proof.pi_b?.[1]?.[1]),
      toBigInt(proof.pi_b?.[1]?.[0]),
      toBigInt(proof.pi_c?.[0]),
      toBigInt(proof.pi_c?.[1])
    ];
  }

  private formatPublicInputs(inputs: string[]): bigint[] {
    return inputs.map(input => {
      const num = parseFloat(input);
      if (isNaN(num)) return 0n;
      return BigInt(Math.floor(num));
    });
  }

  public optimizeBundle(proofBundle: ProofBundle): ProofBundle {
    // Optimize public inputs by removing redundant data
    const optimizedBundle = { ...proofBundle };

    // Remove duplicate public inputs across proofs
    optimizedBundle.handshakeProof.publicInputs = this.deduplicateInputs(
      optimizedBundle.handshakeProof.publicInputs
    );
    optimizedBundle.sessionProof.publicInputs = this.deduplicateInputs(
      optimizedBundle.sessionProof.publicInputs
    );
    optimizedBundle.dataProof.publicInputs = this.deduplicateInputs(
      optimizedBundle.dataProof.publicInputs
    );

    // Recalculate gas estimate with optimization savings
    const baseGas = this.estimateBundleGas(
      optimizedBundle.handshakeProof,
      optimizedBundle.sessionProof,
      optimizedBundle.dataProof
    );
    
    // Apply 10% savings for optimization
    optimizedBundle.metadata.gasEstimate = Math.floor(baseGas * 0.9);

    return optimizedBundle;
  }

  private deduplicateInputs(inputs: string[]): string[] {
    return [...new Set(inputs)];
  }

  public validateProofBundle(proofBundle: ProofBundle): {
    valid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    // Validate proof structure
    if (!proofBundle.handshakeProof.proof || !proofBundle.handshakeProof.publicInputs || !proofBundle.handshakeProof.verificationKey) {
      errors.push('Invalid handshake proof structure');
    }
    if (!proofBundle.sessionProof.proof || !proofBundle.sessionProof.publicInputs || !proofBundle.sessionProof.verificationKey) {
      errors.push('Invalid session proof structure');
    }
    if (!proofBundle.dataProof.proof || !proofBundle.dataProof.publicInputs || !proofBundle.dataProof.verificationKey) {
      errors.push('Invalid data proof structure');
    }

    // Validate metadata
    if (!proofBundle.metadata.sessionId) {
      errors.push('Missing session ID');
    }
    if (proofBundle.metadata.gasEstimate <= 0) {
      errors.push('Invalid gas estimate');
    }

    // Validate proof consistency
    const sessionCommitmentFromHandshake = this.extractSessionCommitment(
      proofBundle.handshakeProof.publicInputs
    );
    const sessionCommitmentFromData = this.extractSessionCommitment(
      proofBundle.dataProof.publicInputs
    );

    if (sessionCommitmentFromHandshake !== sessionCommitmentFromData) {
      errors.push('Session commitment mismatch between proofs');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  private extractSessionCommitment(publicInputs: string[]): string {
    // Extract session commitment from public inputs (placeholder implementation)
    return publicInputs[0] || '';
  }

  public splitBundle(batchBundle: BatchProofBundle, maxGasPerTx: number): BatchProofBundle[] {
    if (batchBundle.totalGasEstimate <= maxGasPerTx) {
      return [batchBundle];
    }

    const batches: BatchProofBundle[] = [];
    let currentBatch: ProofBundle[] = [];
    let currentGas = 0;

    for (const proof of batchBundle.proofs) {
      const proofGas = proof.metadata.gasEstimate;

      if (currentGas + proofGas > maxGasPerTx && currentBatch.length > 0) {
        batches.push(this.createBatchBundle(currentBatch));
        currentBatch = [];
        currentGas = 0;
      }

      currentBatch.push(proof);
      currentGas += proofGas;
    }

    if (currentBatch.length > 0) {
      batches.push(this.createBatchBundle(currentBatch));
    }

    return batches;
  }
}