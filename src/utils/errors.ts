export class ZephisError extends Error {
  public readonly code: string;
  public readonly component: string;
  public readonly context: Record<string, any> | undefined;
  public readonly timestamp: Date;

  constructor(
    message: string,
    code: string,
    component: string,
    context?: Record<string, any>,
    cause?: Error
  ) {
    super(message);
    this.name = 'ZephisError';
    this.code = code;
    this.component = component;
    this.context = context;
    this.timestamp = new Date();

    // Maintains proper stack trace for where our error was thrown
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }

    if (cause) {
      this.stack = `${this.stack}\nCaused by: ${cause.stack}`;
    }
  }

  public toJSON(): Record<string, any> {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      component: this.component,
      context: this.context,
      timestamp: this.timestamp.toISOString(),
      stack: this.stack,
    };
  }
}

// TLS-related errors
export class TLSError extends ZephisError {
  constructor(message: string, code: string, context?: Record<string, any>, cause?: Error) {
    super(message, code, 'TLS', context, cause);
    this.name = 'TLSError';
  }
}

export class HandshakeError extends TLSError {
  constructor(message: string, code: string, context?: Record<string, any>, cause?: Error) {
    super(message, code, context, cause);
    this.name = 'HandshakeError';
  }
}

export class KeyExtractionError extends TLSError {
  constructor(message: string, code: string, context?: Record<string, any>, cause?: Error) {
    super(message, code, context, cause);
    this.name = 'KeyExtractionError';
  }
}

// Cryptography-related errors
export class CryptographyError extends ZephisError {
  constructor(message: string, code: string, context?: Record<string, any>, cause?: Error) {
    super(message, code, 'Cryptography', context, cause);
    this.name = 'CryptographyError';
  }
}

export class HashingError extends CryptographyError {
  constructor(message: string, code: string, context?: Record<string, any>, cause?: Error) {
    super(message, code, context, cause);
    this.name = 'HashingError';
  }
}

export class CommitmentError extends CryptographyError {
  constructor(message: string, code: string, context?: Record<string, any>, cause?: Error) {
    super(message, code, context, cause);
    this.name = 'CommitmentError';
  }
}

// Proof generation errors
export class ProofError extends ZephisError {
  constructor(message: string, code: string, context?: Record<string, any>, cause?: Error) {
    super(message, code, 'ProofGeneration', context, cause);
    this.name = 'ProofError';
  }
}

export class CircuitError extends ProofError {
  constructor(message: string, code: string, context?: Record<string, any>, cause?: Error) {
    super(message, code, context, cause);
    this.name = 'CircuitError';
  }
}

export class VerificationError extends ProofError {
  constructor(message: string, code: string, context?: Record<string, any>, cause?: Error) {
    super(message, code, context, cause);
    this.name = 'VerificationError';
  }
}

// Chain interaction errors
export class ChainError extends ZephisError {
  constructor(message: string, code: string, context?: Record<string, any>, cause?: Error) {
    super(message, code, 'Chain', context, cause);
    this.name = 'ChainError';
  }
}

export class TransactionError extends ChainError {
  constructor(message: string, code: string, context?: Record<string, any>, cause?: Error) {
    super(message, code, context, cause);
    this.name = 'TransactionError';
  }
}

export class GasEstimationError extends ChainError {
  constructor(message: string, code: string, context?: Record<string, any>, cause?: Error) {
    super(message, code, context, cause);
    this.name = 'GasEstimationError';
  }
}

// Configuration errors
export class ConfigurationError extends ZephisError {
  constructor(message: string, code: string, context?: Record<string, any>, cause?: Error) {
    super(message, code, 'Configuration', context, cause);
    this.name = 'ConfigurationError';
  }
}

// Security errors
export class SecurityError extends ZephisError {
  constructor(message: string, code: string, context?: Record<string, any>, cause?: Error) {
    super(message, code, 'Security', context, cause);
    this.name = 'SecurityError';
  }
}

export class ValidationError extends ZephisError {
  constructor(message: string, code: string, context?: Record<string, any>, cause?: Error) {
    super(message, code, 'Validation', context, cause);
    this.name = 'ValidationError';
  }
}

// Error codes constants
export const ErrorCodes = {
  // TLS Error Codes
  HANDSHAKE_INCOMPLETE: 'TLS_HANDSHAKE_INCOMPLETE',
  HANDSHAKE_TIMEOUT: 'TLS_HANDSHAKE_TIMEOUT',
  INVALID_CIPHER_SUITE: 'TLS_INVALID_CIPHER_SUITE',
  CERTIFICATE_INVALID: 'TLS_CERTIFICATE_INVALID',
  KEY_EXTRACTION_FAILED: 'TLS_KEY_EXTRACTION_FAILED',
  UNSUPPORTED_TLS_VERSION: 'TLS_UNSUPPORTED_VERSION',
  
  // Cryptography Error Codes
  HASHING_FAILED: 'CRYPTO_HASHING_FAILED',
  INVALID_FIELD_ELEMENT: 'CRYPTO_INVALID_FIELD_ELEMENT',
  COMMITMENT_FAILED: 'CRYPTO_COMMITMENT_FAILED',
  MERKLE_PROOF_INVALID: 'CRYPTO_MERKLE_PROOF_INVALID',
  RANDOM_GENERATION_FAILED: 'CRYPTO_RANDOM_GENERATION_FAILED',
  
  // Proof Generation Error Codes
  CIRCUIT_NOT_INITIALIZED: 'PROOF_CIRCUIT_NOT_INITIALIZED',
  CIRCUIT_LOADING_FAILED: 'PROOF_CIRCUIT_LOADING_FAILED',
  PROOF_GENERATION_FAILED: 'PROOF_GENERATION_FAILED',
  PROOF_VERIFICATION_FAILED: 'PROOF_VERIFICATION_FAILED',
  INVALID_PROOF_INPUTS: 'PROOF_INVALID_INPUTS',
  
  // Chain Error Codes
  CHAIN_NOT_CONFIGURED: 'CHAIN_NOT_CONFIGURED',
  WALLET_NOT_CONFIGURED: 'CHAIN_WALLET_NOT_CONFIGURED',
  TRANSACTION_FAILED: 'CHAIN_TRANSACTION_FAILED',
  GAS_ESTIMATION_FAILED: 'CHAIN_GAS_ESTIMATION_FAILED',
  INSUFFICIENT_GAS: 'CHAIN_INSUFFICIENT_GAS',
  NETWORK_ERROR: 'CHAIN_NETWORK_ERROR',
  CONTRACT_CALL_FAILED: 'CHAIN_CONTRACT_CALL_FAILED',
  
  // Configuration Error Codes
  MISSING_CONFIG: 'CONFIG_MISSING',
  INVALID_CONFIG: 'CONFIG_INVALID',
  MISSING_REQUIRED_FIELD: 'CONFIG_MISSING_REQUIRED_FIELD',
  
  // Security Error Codes
  UNAUTHORIZED_ACCESS: 'SECURITY_UNAUTHORIZED_ACCESS',
  INVALID_SIGNATURE: 'SECURITY_INVALID_SIGNATURE',
  REPLAY_ATTACK_DETECTED: 'SECURITY_REPLAY_ATTACK_DETECTED',
  TAMPERING_DETECTED: 'SECURITY_TAMPERING_DETECTED',
  
  // Validation Error Codes
  INVALID_INPUT: 'VALIDATION_INVALID_INPUT',
  MISSING_REQUIRED_PARAMETER: 'VALIDATION_MISSING_REQUIRED_PARAMETER',
  PARAMETER_OUT_OF_RANGE: 'VALIDATION_PARAMETER_OUT_OF_RANGE',
  INVALID_FORMAT: 'VALIDATION_INVALID_FORMAT',
} as const;

// Error factory functions for common error patterns
export const createHandshakeError = (
  message: string,
  context?: Record<string, any>,
  cause?: Error
): HandshakeError => {
  return new HandshakeError(
    message,
    ErrorCodes.HANDSHAKE_INCOMPLETE,
    context,
    cause
  );
};

export const createKeyExtractionError = (
  message: string,
  context?: Record<string, any>,
  cause?: Error
): KeyExtractionError => {
  return new KeyExtractionError(
    message,
    ErrorCodes.KEY_EXTRACTION_FAILED,
    context,
    cause
  );
};

export const createProofGenerationError = (
  message: string,
  context?: Record<string, any>,
  cause?: Error
): ProofError => {
  return new ProofError(
    message,
    ErrorCodes.PROOF_GENERATION_FAILED,
    context,
    cause
  );
};

export const createChainError = (
  message: string,
  code: string,
  context?: Record<string, any>,
  cause?: Error
): ChainError => {
  return new ChainError(message, code, context, cause);
};

export const createConfigurationError = (
  message: string,
  context?: Record<string, any>,
  cause?: Error
): ConfigurationError => {
  return new ConfigurationError(
    message,
    ErrorCodes.INVALID_CONFIG,
    context,
    cause
  );
};

export const createSecurityError = (
  message: string,
  code: string,
  context?: Record<string, any>,
  cause?: Error
): SecurityError => {
  return new SecurityError(message, code, context, cause);
};

export const createValidationError = (
  message: string,
  parameter: string,
  value: any,
  cause?: Error
): ValidationError => {
  return new ValidationError(
    message,
    ErrorCodes.INVALID_INPUT,
    { parameter, value },
    cause
  );
};

// Error handling utilities
export const isZephisError = (error: any): error is ZephisError => {
  return error instanceof ZephisError;
};

export const isTLSError = (error: any): error is TLSError => {
  return error instanceof TLSError;
};

export const isProofError = (error: any): error is ProofError => {
  return error instanceof ProofError;
};

export const isChainError = (error: any): error is ChainError => {
  return error instanceof ChainError;
};

export const isSecurityError = (error: any): error is SecurityError => {
  return error instanceof SecurityError;
};

// Error handling wrapper for async functions
export const withErrorHandling = async <T>(
  operation: () => Promise<T>,
  errorFactory: (error: Error) => ZephisError
): Promise<T> => {
  try {
    return await operation();
  } catch (error) {
    if (isZephisError(error)) {
      throw error;
    }
    throw errorFactory(error as Error);
  }
};

// Error handling wrapper for sync functions
export const withSyncErrorHandling = <T>(
  operation: () => T,
  errorFactory: (error: Error) => ZephisError
): T => {
  try {
    return operation();
  } catch (error) {
    if (isZephisError(error)) {
      throw error;
    }
    throw errorFactory(error as Error);
  }
};