import { Hex, Address } from "viem";

export interface ZephisSession {
  id: string;
  containerId: string;
  browserUrl: string;
  vncUrl: string;
  status: SessionStatus;
  createdAt: Date;
  expiresAt: Date;
  metadata?: Record<string, any>;
}

export enum SessionStatus {
  INITIALIZING = "INITIALIZING",
  READY = "READY",
  ACTIVE = "ACTIVE",
  CAPTURING = "CAPTURING",
  PROVING = "PROVING",
  COMPLETED = "COMPLETED",
  FAILED = "FAILED",
  DESTROYED = "DESTROYED",
}

export interface Template {
  domain: string;
  name: string;
  version?: string;
  selectors: Record<string, string>;
  extractors: Record<string, string>;
  validation?: TemplateValidation;
  circuitConfig?: CircuitTemplateConfig;
}

export interface TemplateValidation {
  requiredFields?: string[];
  maxDataSize?: number;
  allowedDomains?: string[];
  fieldTypes?: Record<string, string>;
}

export interface ProofRequest {
  template: string | Template;
  claim: string;
  params?: Record<string, any>;
  chainId?: number;
}

export interface TLSSessionData {
  serverCertificate: string;
  sessionKeys: {
    clientRandom: Hex;
    serverRandom: Hex;
    masterSecret: Hex;
  };
  handshakeMessages: Hex[];
  timestamp: number;
}

export interface ExtractedData {
  raw: Record<string, string>;
  processed: Record<string, any>;
  timestamp: number;
  url: string;
  domain: string;
}

export interface ZKProof {
  proof: {
    a: [string, string];
    b: [[string, string], [string, string]];
    c: [string, string];
  };
  publicInputs: string[];
  metadata: ProofMetadata;
}

export interface ProofMetadata {
  sessionId: string;
  template: string;
  claim: string;
  timestamp: number;
  domain: string;
  circuitId: string;
}

export interface VerificationResult {
  valid: boolean;
  timestamp: number;
  verifier?: Address;
  transactionHash?: Hex;
  error?: string;
}

export interface ContainerConfig {
  image: string;
  memory: string;
  cpuShares: number;
  timeout: number;
  network: string;
  volumes?: string[];
  environment?: Record<string, string>;
}

export interface BrowserConfig {
  headless: boolean;
  args: string[];
  defaultViewport: {
    width: number;
    height: number;
  };
  timeout: number;
}

export interface CircuitConfig {
  name: string;
  wasmPath: string;
  zkeyPath: string;
  verificationKeyPath: string;
}

export interface APIResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  timestamp: number;
}

// Circuit-related type definitions
export interface CircuitTemplateConfig {
  dataType: "numeric" | "string" | "boolean";
  claimType: "comparison" | "existence" | "pattern";
  maxDataLength: number;
  supportedClaims?: ClaimDefinition[];
}

export interface ClaimDefinition {
  name: string;
  dataType: "numeric" | "string" | "boolean";
  claimType: "comparison" | "existence" | "pattern";
  description: string;
  maxDataLength?: number;
  validation?: ValidationRule[];
  pattern?: string;
}

export interface ValidationRule {
  field: string;
  type: "required" | "numeric" | "pattern" | "range";
  constraint?: any;
  errorMessage: string;
}

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

export interface DynamicCircuitConfig {
  templateConfig: CircuitTemplateConfig;
  circuitName: string;
  buildRequired: boolean;
  cacheEnabled: boolean;
}

// Enhanced ProofRequest to support dynamic circuits
export interface DynamicProofRequest extends ProofRequest {
  circuitConfig?: DynamicCircuitConfig;
  validationRules?: ValidationRule[];
}
