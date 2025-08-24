import { LogLevel } from './logger';

export interface ZephisConfig {
  // Network Configuration
  supportedChainIds: number[];
  defaultChainId: number;
  txConfirmations: number;
  
  // Gas Settings
  maxProofBatchSize: number;
  gasEstimationBuffer: number;
  handshakeProofGas: number;
  sessionProofGas: number;
  dataProofGas: number;
  publicInputGasCost: number;
  batchSavingsPercentage: number;
  batchOverheadBase: number;
  batchOverheadPerProof: number;
  minimumBatchGas: number;
  
  // Cryptographic Parameters
  poseidonFieldSize: string;
  fieldElementChunkSize: number;
  defaultHashAlgorithm: string;
  masterSecretLength: number;
  finishedMessageLength: number;
  defaultKeyLength: number;
  
  // Circuit Paths
  circuitsBasePath: string;
  handshakeCircuitWasmPath: string;
  handshakeCircuitZkeyPath: string;
  sessionCircuitWasmPath: string;
  sessionCircuitZkeyPath: string;
  dataCircuitWasmPath: string;
  dataCircuitZkeyPath: string;
  
  // Contract Addresses
  verifierContractAddress: string;
  batchVerifierContractAddress: string;
  
  // TLS Configuration
  supportedCipherSuites: string[];
  tlsKeyBlockSizes: Record<string, number>;
  
  // Test Configuration
  testTimeout: number;
  testHookTimeout: number;
  
  // Logging
  logLevel: LogLevel;
}

function parseNumberArray(value: string | undefined, defaultValue: number[]): number[] {
  if (!value) return defaultValue;
  return value.split(',').map(id => parseInt(id.trim(), 10)).filter(id => !isNaN(id));
}

function parseJsonObject<T>(value: string | undefined, defaultValue: T): T {
  if (!value) return defaultValue;
  try {
    return JSON.parse(value) as T;
  } catch {
    return defaultValue;
  }
}

function getEnvString(key: string, defaultValue: string): string {
  return process.env[key] || defaultValue;
}

function getEnvNumber(key: string, defaultValue: number): number {
  const value = process.env[key];
  if (!value) return defaultValue;
  const parsed = parseInt(value, 10);
  return isNaN(parsed) ? defaultValue : parsed;
}

function getEnvFloat(key: string, defaultValue: number): number {
  const value = process.env[key];
  if (!value) return defaultValue;
  const parsed = parseFloat(value);
  return isNaN(parsed) ? defaultValue : parsed;
}

function getLogLevelFromEnv(): LogLevel {
  const envLevel = process.env.LOG_LEVEL?.toUpperCase();
  switch (envLevel) {
    case 'DEBUG': return LogLevel.DEBUG;
    case 'INFO': return LogLevel.INFO;
    case 'WARN': return LogLevel.WARN;
    case 'ERROR': return LogLevel.ERROR;
    default: return LogLevel.INFO;
  }
}

const defaultConfig: ZephisConfig = {
  // Network Configuration
  supportedChainIds: [1, 11155111, 137, 42161],
  defaultChainId: 11155111,
  txConfirmations: 1,
  
  // Gas Settings
  maxProofBatchSize: 10,
  gasEstimationBuffer: 50000,
  handshakeProofGas: 250000,
  sessionProofGas: 280000,
  dataProofGas: 320000,
  publicInputGasCost: 3000,
  batchSavingsPercentage: 0.15,
  batchOverheadBase: 30000,
  batchOverheadPerProof: 3000,
  minimumBatchGas: 200000,
  
  // Cryptographic Parameters
  poseidonFieldSize: '21888242871839275222246405745257275088548364400416034343698204186575808495617',
  fieldElementChunkSize: 31,
  defaultHashAlgorithm: 'sha256',
  masterSecretLength: 48,
  finishedMessageLength: 12,
  defaultKeyLength: 32,
  
  // Circuit Paths
  circuitsBasePath: './circuits',
  handshakeCircuitWasmPath: './circuits/handshake.wasm',
  handshakeCircuitZkeyPath: './circuits/handshake.zkey',
  sessionCircuitWasmPath: './circuits/session.wasm',
  sessionCircuitZkeyPath: './circuits/session.zkey',
  dataCircuitWasmPath: './circuits/data.wasm',
  dataCircuitZkeyPath: './circuits/data.zkey',
  
  // Contract Addresses
  verifierContractAddress: '0x1234567890123456789012345678901234567890',
  batchVerifierContractAddress: '0x0987654321098765432109876543210987654321',
  
  // TLS Configuration
  supportedCipherSuites: [
    'TLS_RSA_WITH_AES_128_CBC_SHA',
    'TLS_RSA_WITH_AES_256_CBC_SHA',
    'TLS_RSA_WITH_AES_128_CBC_SHA256',
    'TLS_RSA_WITH_AES_256_CBC_SHA256',
    'TLS_RSA_WITH_AES_128_GCM_SHA256',
    'TLS_RSA_WITH_AES_256_GCM_SHA384'
  ],
  tlsKeyBlockSizes: {
    'TLS_RSA_WITH_AES_128_CBC_SHA': 104,
    'TLS_RSA_WITH_AES_256_CBC_SHA': 136,
    'TLS_RSA_WITH_AES_128_CBC_SHA256': 104,
    'TLS_RSA_WITH_AES_256_CBC_SHA256': 136,
    'TLS_RSA_WITH_AES_128_GCM_SHA256': 104,
    'TLS_RSA_WITH_AES_256_GCM_SHA384': 136
  },
  
  // Test Configuration
  testTimeout: 30000,
  testHookTimeout: 30000,
  
  // Logging
  logLevel: LogLevel.INFO
};

export function loadConfig(): ZephisConfig {
  return {
    // Network Configuration
    supportedChainIds: parseNumberArray(
      process.env.SUPPORTED_CHAIN_IDS,
      defaultConfig.supportedChainIds
    ),
    defaultChainId: getEnvNumber('DEFAULT_CHAIN_ID', defaultConfig.defaultChainId),
    txConfirmations: getEnvNumber('TX_CONFIRMATIONS', defaultConfig.txConfirmations),
    
    // Gas Settings
    maxProofBatchSize: getEnvNumber('MAX_PROOF_BATCH_SIZE', defaultConfig.maxProofBatchSize),
    gasEstimationBuffer: getEnvNumber('GAS_ESTIMATION_BUFFER', defaultConfig.gasEstimationBuffer),
    handshakeProofGas: getEnvNumber('HANDSHAKE_PROOF_GAS', defaultConfig.handshakeProofGas),
    sessionProofGas: getEnvNumber('SESSION_PROOF_GAS', defaultConfig.sessionProofGas),
    dataProofGas: getEnvNumber('DATA_PROOF_GAS', defaultConfig.dataProofGas),
    publicInputGasCost: getEnvNumber('PUBLIC_INPUT_GAS_COST', defaultConfig.publicInputGasCost),
    batchSavingsPercentage: getEnvFloat('BATCH_SAVINGS_PERCENTAGE', defaultConfig.batchSavingsPercentage),
    batchOverheadBase: getEnvNumber('BATCH_OVERHEAD_BASE', defaultConfig.batchOverheadBase),
    batchOverheadPerProof: getEnvNumber('BATCH_OVERHEAD_PER_PROOF', defaultConfig.batchOverheadPerProof),
    minimumBatchGas: getEnvNumber('MINIMUM_BATCH_GAS', defaultConfig.minimumBatchGas),
    
    // Cryptographic Parameters
    poseidonFieldSize: getEnvString('POSEIDON_FIELD_SIZE', defaultConfig.poseidonFieldSize),
    fieldElementChunkSize: getEnvNumber('FIELD_ELEMENT_CHUNK_SIZE', defaultConfig.fieldElementChunkSize),
    defaultHashAlgorithm: getEnvString('DEFAULT_HASH_ALGORITHM', defaultConfig.defaultHashAlgorithm),
    masterSecretLength: getEnvNumber('MASTER_SECRET_LENGTH', defaultConfig.masterSecretLength),
    finishedMessageLength: getEnvNumber('FINISHED_MESSAGE_LENGTH', defaultConfig.finishedMessageLength),
    defaultKeyLength: getEnvNumber('DEFAULT_KEY_LENGTH', defaultConfig.defaultKeyLength),
    
    // Circuit Paths
    circuitsBasePath: getEnvString('CIRCUITS_BASE_PATH', defaultConfig.circuitsBasePath),
    handshakeCircuitWasmPath: getEnvString('HANDSHAKE_CIRCUIT_WASM_PATH', defaultConfig.handshakeCircuitWasmPath),
    handshakeCircuitZkeyPath: getEnvString('HANDSHAKE_CIRCUIT_ZKEY_PATH', defaultConfig.handshakeCircuitZkeyPath),
    sessionCircuitWasmPath: getEnvString('SESSION_CIRCUIT_WASM_PATH', defaultConfig.sessionCircuitWasmPath),
    sessionCircuitZkeyPath: getEnvString('SESSION_CIRCUIT_ZKEY_PATH', defaultConfig.sessionCircuitZkeyPath),
    dataCircuitWasmPath: getEnvString('DATA_CIRCUIT_WASM_PATH', defaultConfig.dataCircuitWasmPath),
    dataCircuitZkeyPath: getEnvString('DATA_CIRCUIT_ZKEY_PATH', defaultConfig.dataCircuitZkeyPath),
    
    // Contract Addresses
    verifierContractAddress: getEnvString('VERIFIER_CONTRACT_ADDRESS', defaultConfig.verifierContractAddress),
    batchVerifierContractAddress: getEnvString('BATCH_VERIFIER_CONTRACT_ADDRESS', defaultConfig.batchVerifierContractAddress),
    
    // TLS Configuration
    supportedCipherSuites: parseJsonObject(
      process.env.SUPPORTED_CIPHER_SUITES,
      defaultConfig.supportedCipherSuites
    ),
    tlsKeyBlockSizes: parseJsonObject(
      process.env.TLS_KEY_BLOCK_SIZES,
      defaultConfig.tlsKeyBlockSizes
    ),
    
    // Test Configuration
    testTimeout: getEnvNumber('TEST_TIMEOUT', defaultConfig.testTimeout),
    testHookTimeout: getEnvNumber('TEST_HOOK_TIMEOUT', defaultConfig.testHookTimeout),
    
    // Logging
    logLevel: getLogLevelFromEnv()
  };
}

export const config = loadConfig();