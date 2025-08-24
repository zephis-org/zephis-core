// Cryptography
export { PoseidonHasher } from './cryptography/poseidon';
export { HKDF, type HKDFParams } from './cryptography/hkdf';

// TLS Interceptor
export { 
  HandshakeCapture, 
  type TLSHandshakeData, 
  type CipherSuite 
} from './tls-interceptor/handshake-capture';
export { 
  KeyExtraction, 
  type SessionKeys, 
  type KeyMaterial 
} from './tls-interceptor/key-extraction';
export { 
  TranscriptRecorder, 
  type TLSRecord, 
  type TranscriptProof 
} from './tls-interceptor/transcript-recorder';

// Proof Generation
export { 
  HandshakeCircuit, 
  type HandshakeProofInputs, 
  type HandshakeProofOutputs,
  type HandshakeCircuitProof
} from './proof-generation/handshake-circuit';
export { 
  SessionCircuit, 
  type SessionProofInputs, 
  type SessionProofOutputs,
  type SessionCircuitProof
} from './proof-generation/session-circuit';
export { 
  DataCircuit, 
  type DataProofInputs, 
  type DataProofOutputs,
  type DataCircuitProof
} from './proof-generation/data-circuit';

// Commitment Engine
export { 
  KeyCommitmentEngine, 
  type KeyCommitmentData, 
  type KeyCommitment 
} from './commitment-engine/key-commitment';
export { 
  TranscriptHashEngine, 
  type TranscriptRecord, 
  type TranscriptHash,
  type HashCommitment
} from './commitment-engine/transcript-hash';
export { 
  MerkleBuilder, 
  type MerkleNode, 
  type MerkleTree,
  type MerkleProof
} from './commitment-engine/merkle-builder';

// Chain Integration
export { 
  ProofBundler, 
  type ProofBundle, 
  type BatchProofBundle 
} from './verifier-client/proof-bundler';
export { 
  ChainSubmitter, 
  type ChainConfig, 
  type SubmissionResult,
  type BatchSubmissionResult
} from './verifier-client/chain-submitter';

// Import necessary classes for the main class
import { HandshakeCapture } from './tls-interceptor/handshake-capture';
import { KeyExtraction, type SessionKeys } from './tls-interceptor/key-extraction';
import { TranscriptRecorder } from './tls-interceptor/transcript-recorder';
import { KeyCommitmentEngine, type KeyCommitmentData, type KeyCommitment } from './commitment-engine/key-commitment';
import { HandshakeCircuit, type HandshakeProofInputs } from './proof-generation/handshake-circuit';
import { SessionCircuit, type SessionProofInputs } from './proof-generation/session-circuit';
import { DataCircuit, type DataProofInputs } from './proof-generation/data-circuit';
import { ProofBundler, type ProofBundle } from './verifier-client/proof-bundler';
import { ChainSubmitter, type ChainConfig, type SubmissionResult, type BatchSubmissionResult } from './verifier-client/chain-submitter';

// Main ZEPHIS Core class
export class ZephisCore {
  private handshakeCapture: HandshakeCapture | null = null;
  private keyExtraction: KeyExtraction;
  private transcriptRecorder: TranscriptRecorder | null = null;
  private keyCommitmentEngine: KeyCommitmentEngine;
  private handshakeCircuit: HandshakeCircuit | null = null;
  private sessionCircuit: SessionCircuit | null = null;
  private dataCircuit: DataCircuit | null = null;
  private proofBundler: ProofBundler;
  private chainSubmitter: ChainSubmitter | null = null;

  constructor() {
    this.keyExtraction = new KeyExtraction();
    this.keyCommitmentEngine = new KeyCommitmentEngine();
    this.proofBundler = new ProofBundler();
  }

  // Initialize with circuit paths
  public async initialize(config: {
    handshakeCircuit?: {
      wasmPath: string;
      zkeyPath: string;
      verificationKeyPath: string;
    };
    sessionCircuit?: {
      wasmPath: string;
      zkeyPath: string;
      verificationKeyPath: string;
    };
    dataCircuit?: {
      wasmPath: string;
      zkeyPath: string;
      verificationKeyPath: string;
    };
    chainConfig?: ChainConfig;
  }): Promise<void> {
    if (config.handshakeCircuit) {
      this.handshakeCircuit = new HandshakeCircuit(
        config.handshakeCircuit.wasmPath,
        config.handshakeCircuit.zkeyPath,
        config.handshakeCircuit.verificationKeyPath
      );
      await this.handshakeCircuit.initialize();
    }

    if (config.sessionCircuit) {
      this.sessionCircuit = new SessionCircuit(
        config.sessionCircuit.wasmPath,
        config.sessionCircuit.zkeyPath,
        config.sessionCircuit.verificationKeyPath
      );
      await this.sessionCircuit.initialize();
    }

    if (config.dataCircuit) {
      this.dataCircuit = new DataCircuit(
        config.dataCircuit.wasmPath,
        config.dataCircuit.zkeyPath,
        config.dataCircuit.verificationKeyPath
      );
      await this.dataCircuit.initialize();
    }

    if (config.chainConfig) {
      this.chainSubmitter = new ChainSubmitter(config.chainConfig);
    }
  }

  // Start TLS session capture
  public startTLSCapture(socket: any): void {
    this.handshakeCapture = new HandshakeCapture(socket);
    
    // Initialize transcript recorder when we have session commitment
    // This would be set after handshake is complete and keys are extracted
  }

  // Extract keys from captured handshake
  public extractSessionKeys(
    clientKeyExchange: Buffer,
    privateKey?: any
  ): SessionKeys | null {
    if (!this.handshakeCapture) {
      throw new Error('TLS capture not started');
    }

    const handshakeData = this.handshakeCapture.getHandshakeData();
    if (!handshakeData) {
      throw new Error('Handshake data not complete');
    }

    const keyMaterial = this.keyExtraction.extractKeyMaterial(
      handshakeData.clientHello,
      handshakeData.serverHello,
      clientKeyExchange,
      privateKey
    );

    if (!keyMaterial) {
      return null;
    }

    // Determine cipher suite from server hello
    const cipherSuite = this.handshakeCapture.parseCipherSuite(handshakeData.serverHello);
    if (!cipherSuite) {
      throw new Error('Could not determine cipher suite');
    }

    return this.keyExtraction.deriveSessionKeys(keyMaterial, cipherSuite.name);
  }

  // Generate key commitment
  public generateKeyCommitment(
    sessionKeys: SessionKeys,
    metadata: {
      cipherSuite: string;
      tlsVersion: string;
      timestamp: number;
      sessionId: string;
    }
  ): KeyCommitment {
    const keyCommitmentData: KeyCommitmentData = {
      masterSecret: sessionKeys.masterSecret,
      sessionKeys: {
        clientWriteKey: sessionKeys.clientWriteKey,
        serverWriteKey: sessionKeys.serverWriteKey,
        clientWriteIV: sessionKeys.clientWriteIV,
        serverWriteIV: sessionKeys.serverWriteIV,
        clientWriteMac: sessionKeys.clientWriteMac,
        serverWriteMac: sessionKeys.serverWriteMac,
      },
      metadata
    };

    return this.keyCommitmentEngine.generateCommitment(keyCommitmentData);
  }

  // Start transcript recording
  public startTranscriptRecording(sessionCommitment: string): void {
    this.transcriptRecorder = new TranscriptRecorder(sessionCommitment);
    this.transcriptRecorder.startRecording();
  }

  // Record application data
  public recordApplicationData(data: Buffer): void {
    if (!this.transcriptRecorder) {
      throw new Error('Transcript recording not started');
    }
    
    this.transcriptRecorder.processApplicationData(data);
  }

  // Generate complete proof bundle
  public async generateProofBundle(
    sessionId: string,
    handshakeInputs: HandshakeProofInputs,
    sessionInputs: SessionProofInputs,
    dataInputs: DataProofInputs
  ): Promise<ProofBundle> {
    if (!this.handshakeCircuit || !this.sessionCircuit || !this.dataCircuit) {
      throw new Error('Circuits not initialized');
    }

    const handshakeProof = await this.handshakeCircuit.generateProof(handshakeInputs);
    const sessionProof = await this.sessionCircuit.generateProof(sessionInputs);
    const dataProof = await this.dataCircuit.generateProof(dataInputs);

    return this.proofBundler.createProofBundle(
      handshakeProof,
      sessionProof,
      dataProof,
      sessionId
    );
  }

  // Submit proof to blockchain
  public async submitProof(
    proofBundle: ProofBundle
  ): Promise<SubmissionResult> {
    if (!this.chainSubmitter) {
      throw new Error('Chain submitter not configured');
    }

    return this.chainSubmitter.submitProof(proofBundle);
  }

  // Submit batch proof to blockchain
  public async submitBatchProof(
    proofBundles: ProofBundle[]
  ): Promise<BatchSubmissionResult> {
    if (!this.chainSubmitter) {
      throw new Error('Chain submitter not configured');
    }

    const batchBundle = this.proofBundler.createBatchBundle(proofBundles);
    return this.chainSubmitter.submitBatchProof(batchBundle);
  }

  // Get verification result
  public async getVerificationResult(
    transactionHash: string,
    sessionId: string
  ): Promise<{ verified: boolean; proofData?: any; error?: string }> {
    if (!this.chainSubmitter) {
      throw new Error('Chain submitter not configured');
    }

    return this.chainSubmitter.getVerificationResult(
      transactionHash as `0x${string}`,
      sessionId
    );
  }

  // Utility: Estimate gas costs
  public async estimateGasCost(proofBundle: ProofBundle): Promise<{
    gasLimit: bigint;
    gasPrice: bigint;
    estimatedCost: bigint;
  }> {
    if (!this.chainSubmitter) {
      throw new Error('Chain submitter not configured');
    }

    return this.chainSubmitter.estimateGasCost(proofBundle);
  }

  // Clean up resources
  public cleanup(): void {
    if (this.transcriptRecorder) {
      this.transcriptRecorder.stopRecording();
    }
    // Additional cleanup as needed
  }
}