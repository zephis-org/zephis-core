import { describe, it, expect } from 'vitest';
import { 
  ZephisError, 
  TLSError,
  HandshakeError,
  KeyExtractionError,
  CryptographyError,
  HashingError,
  CommitmentError,
  ProofError,
  CircuitError,
  VerificationError,
  ChainError,
  TransactionError,
  GasEstimationError,
  ConfigurationError,
  SecurityError,
  ValidationError,
  ErrorCodes,
  createHandshakeError,
  createKeyExtractionError,
  createProofGenerationError,
  createChainError,
  createConfigurationError,
  createSecurityError,
  createValidationError,
  isZephisError,
  isTLSError,
  isProofError,
  isChainError,
  isSecurityError,
  withErrorHandling,
  withSyncErrorHandling
} from '../../src/utils/errors';

describe('Error Classes', () => {
  describe('ZephisError', () => {
    it('should create base error with message', () => {
      const error = new ZephisError('Test error message', 'TEST_CODE', 'TestComponent');
      expect(error.message).toBe('Test error message');
      expect(error.name).toBe('ZephisError');
      expect(error.code).toBe('TEST_CODE');
      expect(error.component).toBe('TestComponent');
    });

    it('should create error with custom code and context', () => {
      const context = { sessionId: 'test-123' };
      const error = new ZephisError('Test error', 'CUSTOM_CODE', 'TestComponent', context);
      expect(error.code).toBe('CUSTOM_CODE');
      expect(error.context).toEqual(context);
      expect(error.timestamp).toBeInstanceOf(Date);
    });

    it('should have stack trace', () => {
      const error = new ZephisError('Test error', 'TEST_CODE', 'TestComponent');
      expect(error.stack).toBeDefined();
    });

    it('should handle cause error', () => {
      const cause = new Error('Original error');
      const error = new ZephisError('Wrapper error', 'TEST_CODE', 'TestComponent', undefined, cause);
      // The cause should be added to stack if Error.captureStackTrace is available
      if (cause.stack && error.stack?.includes('Caused by:')) {
        expect(error.stack).toContain('Caused by:');
      } else {
        // If stack trace chaining is not available, just check that cause is preserved
        expect(error.cause).toBe(cause);
      }
    });

    it('should serialize to JSON correctly', () => {
      const context = { sessionId: 'test-123', timestamp: Date.now() };
      const error = new ZephisError('Test error', 'TEST_CODE', 'TestComponent', context);
      
      const json = error.toJSON();
      expect(json.message).toBe('Test error');
      expect(json.name).toBe('ZephisError');
      expect(json.code).toBe('TEST_CODE');
      expect(json.component).toBe('TestComponent');
      expect(json.context).toEqual(context);
      expect(json.timestamp).toBeDefined();
    });
  });

  describe('TLSError', () => {
    it('should create TLS error', () => {
      const error = new TLSError('TLS handshake failed', 'TLS_ERROR');
      expect(error.message).toBe('TLS handshake failed');
      expect(error.name).toBe('TLSError');
      expect(error.code).toBe('TLS_ERROR');
      expect(error.component).toBe('TLS');
    });

    it('should include TLS-specific context', () => {
      const context = { port: 443, host: 'example.com' };
      const error = new TLSError('Connection failed', 'TLS_CONNECTION_ERROR', context);
      expect(error.context).toEqual(context);
    });
  });

  describe('HandshakeError', () => {
    it('should create handshake error', () => {
      const error = new HandshakeError('Handshake failed', 'HANDSHAKE_ERROR');
      expect(error.message).toBe('Handshake failed');
      expect(error.name).toBe('HandshakeError');
      expect(error.code).toBe('HANDSHAKE_ERROR');
      expect(error.component).toBe('TLS');
    });

    it('should include handshake context', () => {
      const context = { cipherSuite: 'TLS_RSA_WITH_AES_128_CBC_SHA', step: 'client-hello' };
      const error = new HandshakeError('Client hello failed', 'HANDSHAKE_CLIENT_HELLO_ERROR', context);
      expect(error.context).toEqual(context);
    });
  });

  describe('KeyExtractionError', () => {
    it('should create key extraction error', () => {
      const error = new KeyExtractionError('Key extraction failed', 'KEY_EXTRACTION_ERROR');
      expect(error.message).toBe('Key extraction failed');
      expect(error.name).toBe('KeyExtractionError');
      expect(error.code).toBe('KEY_EXTRACTION_ERROR');
    });

    it('should include key extraction context', () => {
      const context = { keyType: 'masterSecret', step: 'decryption' };
      const error = new KeyExtractionError('Decryption failed', 'KEY_DECRYPTION_ERROR', context);
      expect(error.context).toEqual(context);
    });
  });

  describe('CryptographyError', () => {
    it('should create cryptography error', () => {
      const error = new CryptographyError('Crypto operation failed', 'CRYPTO_ERROR');
      expect(error.message).toBe('Crypto operation failed');
      expect(error.name).toBe('CryptographyError');
      expect(error.code).toBe('CRYPTO_ERROR');
      expect(error.component).toBe('Cryptography');
    });

    it('should include crypto context', () => {
      const context = { operation: 'hash', algorithm: 'poseidon' };
      const error = new CryptographyError('Hashing failed', 'CRYPTO_HASH_ERROR', context);
      expect(error.context).toEqual(context);
    });
  });

  describe('HashingError', () => {
    it('should create hashing error', () => {
      const error = new HashingError('Hash computation failed', 'HASH_ERROR');
      expect(error.message).toBe('Hash computation failed');
      expect(error.name).toBe('HashingError');
      expect(error.code).toBe('HASH_ERROR');
    });
  });

  describe('CommitmentError', () => {
    it('should create commitment error', () => {
      const error = new CommitmentError('Commitment generation failed', 'COMMITMENT_ERROR');
      expect(error.message).toBe('Commitment generation failed');
      expect(error.name).toBe('CommitmentError');
      expect(error.code).toBe('COMMITMENT_ERROR');
    });

    it('should include commitment context', () => {
      const context = { commitmentType: 'sessionKeys', nonce: 'abc123' };
      const error = new CommitmentError('Invalid nonce', 'COMMITMENT_INVALID_NONCE', context);
      expect(error.context).toEqual(context);
    });
  });

  describe('ProofError', () => {
    it('should create proof error', () => {
      const error = new ProofError('Proof generation failed', 'PROOF_ERROR');
      expect(error.message).toBe('Proof generation failed');
      expect(error.name).toBe('ProofError');
      expect(error.code).toBe('PROOF_ERROR');
      expect(error.component).toBe('ProofGeneration');
    });

    it('should include proof context', () => {
      const context = { proofType: 'handshake', circuitPath: '/path/to/circuit' };
      const error = new ProofError('Circuit loading failed', 'PROOF_CIRCUIT_ERROR', context);
      expect(error.context).toEqual(context);
    });
  });

  describe('CircuitError', () => {
    it('should create circuit error', () => {
      const error = new CircuitError('Circuit initialization failed', 'CIRCUIT_ERROR');
      expect(error.message).toBe('Circuit initialization failed');
      expect(error.name).toBe('CircuitError');
      expect(error.code).toBe('CIRCUIT_ERROR');
    });

    it('should include circuit details', () => {
      const context = { circuitType: 'handshake', wasmPath: '/path/to/wasm' };
      const error = new CircuitError('WASM loading failed', 'CIRCUIT_WASM_ERROR', context);
      expect(error.context).toEqual(context);
    });
  });

  describe('VerificationError', () => {
    it('should create verification error', () => {
      const error = new VerificationError('Proof verification failed', 'VERIFICATION_ERROR');
      expect(error.message).toBe('Proof verification failed');
      expect(error.name).toBe('VerificationError');
      expect(error.code).toBe('VERIFICATION_ERROR');
    });
  });

  describe('ChainError', () => {
    it('should create chain error', () => {
      const error = new ChainError('Transaction failed', 'CHAIN_ERROR');
      expect(error.message).toBe('Transaction failed');
      expect(error.name).toBe('ChainError');
      expect(error.code).toBe('CHAIN_ERROR');
      expect(error.component).toBe('Chain');
    });

    it('should include transaction context', () => {
      const context = { txHash: '0x123', gasUsed: 300000, chainId: 1 };
      const error = new ChainError('Out of gas', 'CHAIN_OUT_OF_GAS', context);
      expect(error.context).toEqual(context);
    });
  });

  describe('TransactionError', () => {
    it('should create transaction error', () => {
      const error = new TransactionError('Transaction reverted', 'TX_REVERTED');
      expect(error.message).toBe('Transaction reverted');
      expect(error.name).toBe('TransactionError');
      expect(error.code).toBe('TX_REVERTED');
    });
  });

  describe('GasEstimationError', () => {
    it('should create gas estimation error', () => {
      const error = new GasEstimationError('Gas estimation failed', 'GAS_ESTIMATION_ERROR');
      expect(error.message).toBe('Gas estimation failed');
      expect(error.name).toBe('GasEstimationError');
      expect(error.code).toBe('GAS_ESTIMATION_ERROR');
    });
  });

  describe('ConfigurationError', () => {
    it('should create configuration error', () => {
      const error = new ConfigurationError('Missing configuration', 'CONFIG_ERROR');
      expect(error.message).toBe('Missing configuration');
      expect(error.name).toBe('ConfigurationError');
      expect(error.code).toBe('CONFIG_ERROR');
      expect(error.component).toBe('Configuration');
    });
  });

  describe('SecurityError', () => {
    it('should create security error', () => {
      const error = new SecurityError('Unauthorized access', 'SECURITY_ERROR');
      expect(error.message).toBe('Unauthorized access');
      expect(error.name).toBe('SecurityError');
      expect(error.code).toBe('SECURITY_ERROR');
      expect(error.component).toBe('Security');
    });
  });

  describe('ValidationError', () => {
    it('should create validation error', () => {
      const error = new ValidationError('Input validation failed', 'VALIDATION_ERROR');
      expect(error.message).toBe('Input validation failed');
      expect(error.name).toBe('ValidationError');
      expect(error.code).toBe('VALIDATION_ERROR');
      expect(error.component).toBe('Validation');
    });

    it('should include validation details', () => {
      const context = { field: 'sessionId', expected: 'string', received: 'number' };
      const error = new ValidationError('Invalid type', 'VALIDATION_INVALID_TYPE', context);
      expect(error.context).toEqual(context);
    });
  });

  describe('ErrorCodes', () => {
    it('should have all required error codes', () => {
      expect(ErrorCodes.HANDSHAKE_INCOMPLETE).toBe('TLS_HANDSHAKE_INCOMPLETE');
      expect(ErrorCodes.KEY_EXTRACTION_FAILED).toBe('TLS_KEY_EXTRACTION_FAILED');
      expect(ErrorCodes.HASHING_FAILED).toBe('CRYPTO_HASHING_FAILED');
      expect(ErrorCodes.CIRCUIT_NOT_INITIALIZED).toBe('PROOF_CIRCUIT_NOT_INITIALIZED');
      expect(ErrorCodes.CHAIN_NOT_CONFIGURED).toBe('CHAIN_NOT_CONFIGURED');
      expect(ErrorCodes.UNAUTHORIZED_ACCESS).toBe('SECURITY_UNAUTHORIZED_ACCESS');
      expect(ErrorCodes.INVALID_INPUT).toBe('VALIDATION_INVALID_INPUT');
    });
  });

  describe('Error factory functions', () => {
    it('should create handshake error with factory', () => {
      const context = { step: 'client-hello' };
      const error = createHandshakeError('Handshake failed', context);
      
      expect(error).toBeInstanceOf(HandshakeError);
      expect(error.message).toBe('Handshake failed');
      expect(error.code).toBe(ErrorCodes.HANDSHAKE_INCOMPLETE);
      expect(error.context).toEqual(context);
    });

    it('should create key extraction error with factory', () => {
      const context = { keyType: 'master' };
      const error = createKeyExtractionError('Key extraction failed', context);
      
      expect(error).toBeInstanceOf(KeyExtractionError);
      expect(error.message).toBe('Key extraction failed');
      expect(error.code).toBe(ErrorCodes.KEY_EXTRACTION_FAILED);
      expect(error.context).toEqual(context);
    });

    it('should create proof generation error with factory', () => {
      const context = { proofType: 'handshake' };
      const error = createProofGenerationError('Proof failed', context);
      
      expect(error).toBeInstanceOf(ProofError);
      expect(error.message).toBe('Proof failed');
      expect(error.code).toBe(ErrorCodes.PROOF_GENERATION_FAILED);
      expect(error.context).toEqual(context);
    });

    it('should create chain error with factory', () => {
      const context = { chainId: 1 };
      const error = createChainError('Chain error', ErrorCodes.CHAIN_NOT_CONFIGURED, context);
      
      expect(error).toBeInstanceOf(ChainError);
      expect(error.message).toBe('Chain error');
      expect(error.code).toBe(ErrorCodes.CHAIN_NOT_CONFIGURED);
      expect(error.context).toEqual(context);
    });

    it('should create configuration error with factory', () => {
      const context = { configPath: '/path/to/config' };
      const error = createConfigurationError('Config error', context);
      
      expect(error).toBeInstanceOf(ConfigurationError);
      expect(error.message).toBe('Config error');
      expect(error.code).toBe(ErrorCodes.INVALID_CONFIG);
      expect(error.context).toEqual(context);
    });

    it('should create security error with factory', () => {
      const context = { attemptedAction: 'unauthorized_access' };
      const error = createSecurityError('Security violation', ErrorCodes.UNAUTHORIZED_ACCESS, context);
      
      expect(error).toBeInstanceOf(SecurityError);
      expect(error.message).toBe('Security violation');
      expect(error.code).toBe(ErrorCodes.UNAUTHORIZED_ACCESS);
      expect(error.context).toEqual(context);
    });

    it('should create validation error with factory', () => {
      const error = createValidationError('Invalid input', 'sessionId', 123);
      
      expect(error).toBeInstanceOf(ValidationError);
      expect(error.message).toBe('Invalid input');
      expect(error.code).toBe(ErrorCodes.INVALID_INPUT);
      expect(error.context).toEqual({ parameter: 'sessionId', value: 123 });
    });
  });

  describe('Error type guards', () => {
    it('should identify ZephisError instances', () => {
      const zephisError = new ZephisError('Test', 'TEST', 'Test');
      const regularError = new Error('Regular error');
      
      expect(isZephisError(zephisError)).toBe(true);
      expect(isZephisError(regularError)).toBe(false);
    });

    it('should identify TLS error instances', () => {
      const tlsError = new TLSError('TLS error', 'TLS_ERROR');
      const regularError = new Error('Regular error');
      
      expect(isTLSError(tlsError)).toBe(true);
      expect(isTLSError(regularError)).toBe(false);
    });

    it('should identify proof error instances', () => {
      const proofError = new ProofError('Proof error', 'PROOF_ERROR');
      const regularError = new Error('Regular error');
      
      expect(isProofError(proofError)).toBe(true);
      expect(isProofError(regularError)).toBe(false);
    });

    it('should identify chain error instances', () => {
      const chainError = new ChainError('Chain error', 'CHAIN_ERROR');
      const regularError = new Error('Regular error');
      
      expect(isChainError(chainError)).toBe(true);
      expect(isChainError(regularError)).toBe(false);
    });

    it('should identify security error instances', () => {
      const securityError = new SecurityError('Security error', 'SECURITY_ERROR');
      const regularError = new Error('Regular error');
      
      expect(isSecurityError(securityError)).toBe(true);
      expect(isSecurityError(regularError)).toBe(false);
    });
  });

  describe('Error handling utilities', () => {
    it('should handle async operations with error wrapping', async () => {
      const operation = async () => {
        throw new Error('Operation failed');
      };
      
      const errorFactory = (error: Error) => new ZephisError(error.message, 'WRAPPED_ERROR', 'Test');
      
      await expect(withErrorHandling(operation, errorFactory))
        .rejects.toThrow(ZephisError);
    });

    it('should pass through ZephisError instances in async operations', async () => {
      const zephisError = new ZephisError('Zephis error', 'ZEPHIS_ERROR', 'Test');
      const operation = async () => {
        throw zephisError;
      };
      
      const errorFactory = (error: Error) => new ZephisError('Should not be called', 'WRAPPER', 'Test');
      
      await expect(withErrorHandling(operation, errorFactory))
        .rejects.toBe(zephisError);
    });

    it('should handle sync operations with error wrapping', () => {
      const operation = () => {
        throw new Error('Operation failed');
      };
      
      const errorFactory = (error: Error) => new ZephisError(error.message, 'WRAPPED_ERROR', 'Test');
      
      expect(() => withSyncErrorHandling(operation, errorFactory))
        .toThrow(ZephisError);
    });

    it('should pass through ZephisError instances in sync operations', () => {
      const zephisError = new ZephisError('Zephis error', 'ZEPHIS_ERROR', 'Test');
      const operation = () => {
        throw zephisError;
      };
      
      const errorFactory = (error: Error) => new ZephisError('Should not be called', 'WRAPPER', 'Test');
      
      expect(() => withSyncErrorHandling(operation, errorFactory))
        .toThrow(zephisError);
    });

    it('should return successful async operation results', async () => {
      const operation = async () => 'success';
      const errorFactory = (error: Error) => new ZephisError(error.message, 'WRAPPER', 'Test');
      
      const result = await withErrorHandling(operation, errorFactory);
      expect(result).toBe('success');
    });

    it('should return successful sync operation results', () => {
      const operation = () => 'success';
      const errorFactory = (error: Error) => new ZephisError(error.message, 'WRAPPER', 'Test');
      
      const result = withSyncErrorHandling(operation, errorFactory);
      expect(result).toBe('success');
    });
  });

  describe('error inheritance', () => {
    it('should maintain proper inheritance chain', () => {
      const handshakeError = new HandshakeError('Test', 'TEST');
      
      expect(handshakeError instanceof HandshakeError).toBe(true);
      expect(handshakeError instanceof TLSError).toBe(true);
      expect(handshakeError instanceof ZephisError).toBe(true);
      expect(handshakeError instanceof Error).toBe(true);
    });

    it('should maintain proper inheritance for all error types', () => {
      const errors = [
        new TLSError('TLS', 'TLS'),
        new HandshakeError('Handshake', 'HANDSHAKE'),
        new KeyExtractionError('Key', 'KEY'),
        new CryptographyError('Crypto', 'CRYPTO'),
        new HashingError('Hash', 'HASH'),
        new CommitmentError('Commit', 'COMMIT'),
        new ProofError('Proof', 'PROOF'),
        new CircuitError('Circuit', 'CIRCUIT'),
        new VerificationError('Verify', 'VERIFY'),
        new ChainError('Chain', 'CHAIN'),
        new TransactionError('Transaction', 'TX'),
        new GasEstimationError('Gas', 'GAS'),
        new ConfigurationError('Config', 'CONFIG'),
        new SecurityError('Security', 'SECURITY'),
        new ValidationError('Validation', 'VALIDATION')
      ];

      errors.forEach(error => {
        expect(error instanceof ZephisError).toBe(true);
        expect(error instanceof Error).toBe(true);
        expect(error.name).toBeDefined();
        expect(error.code).toBeDefined();
        expect(error.component).toBeDefined();
      });
    });
  });
});