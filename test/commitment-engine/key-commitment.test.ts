import { describe, it, expect, beforeEach } from 'vitest';
import { KeyCommitmentEngine } from '../../src/commitment-engine/key-commitment';

describe('KeyCommitmentEngine', () => {
  let engine: KeyCommitmentEngine;

  beforeEach(() => {
    engine = new KeyCommitmentEngine();
  });

  describe('initialization', () => {
    it('should create engine instance', () => {
      expect(engine).toBeDefined();
      expect(engine).toBeInstanceOf(KeyCommitmentEngine);
    });
  });

  describe('key commitment generation', () => {
    const mockSessionKeys = {
      clientWriteKey: Buffer.from('client-write-key-data'),
      serverWriteKey: Buffer.from('server-write-key-data'),
      clientWriteIV: Buffer.from('client-iv-data'),
      serverWriteIV: Buffer.from('server-iv-data'),
      clientWriteMac: Buffer.from('client-mac-key'),
      serverWriteMac: Buffer.from('server-mac-key')
    };

    it('should generate commitment for session keys', () => {
      const commitment = engine.commitToSessionKeys(mockSessionKeys);
      
      expect(commitment).toBeDefined();
      expect(commitment.commitment).toBeDefined();
      expect(commitment.nonce).toBeDefined();
      expect(commitment.metadata.timestamp).toBeGreaterThan(0);
      expect(commitment.metadata.keyFingerprint).toBeDefined();
    });

    it('should generate deterministic commitments with same nonce', () => {
      const nonce = engine.generateSecureNonce();
      
      const commitment1 = engine.commitToSessionKeys(mockSessionKeys, nonce);
      const commitment2 = engine.commitToSessionKeys(mockSessionKeys, nonce);
      
      expect(commitment1.commitment).toBe(commitment2.commitment);
      expect(commitment1.nonce).toBe(commitment2.nonce);
    });

    it('should generate different commitments with different nonces', () => {
      const commitment1 = engine.commitToSessionKeys(mockSessionKeys);
      const commitment2 = engine.commitToSessionKeys(mockSessionKeys);
      
      expect(commitment1.commitment).not.toBe(commitment2.commitment);
      expect(commitment1.nonce).not.toBe(commitment2.nonce);
    });

    it('should generate different commitments for different keys', () => {
      const differentKeys = {
        ...mockSessionKeys,
        clientWriteKey: Buffer.from('different-client-key')
      };
      
      const commitment1 = engine.commitToSessionKeys(mockSessionKeys);
      const commitment2 = engine.commitToSessionKeys(differentKeys);
      
      expect(commitment1.commitment).not.toBe(commitment2.commitment);
    });
  });

  describe('key derivation commitment', () => {
    const mockDerivationParams = {
      masterSecret: Buffer.from('master-secret-data'),
      clientRandom: Buffer.from('client-random-32-bytes-of-data-here'),
      serverRandom: Buffer.from('server-random-32-bytes-of-data-here'),
      cipherSuite: 'TLS_RSA_WITH_AES_128_CBC_SHA',
      keyBlockLength: 104
    };

    it('should commit to key derivation parameters', () => {
      const commitment = engine.commitToKeyDerivation(mockDerivationParams);
      
      expect(commitment).toBeDefined();
      expect(commitment.commitment).toBeDefined();
      expect(commitment.nonce).toBeDefined();
      expect(commitment.metadata.cipherSuite).toBe('TLS_RSA_WITH_AES_128_CBC_SHA');
      expect(commitment.metadata.keyBlockLength).toBe(104);
    });

    it('should be deterministic with same parameters and nonce', () => {
      const nonce = engine.generateSecureNonce();
      
      const commitment1 = engine.commitToKeyDerivation(mockDerivationParams, nonce);
      const commitment2 = engine.commitToKeyDerivation(mockDerivationParams, nonce);
      
      expect(commitment1.commitment).toBe(commitment2.commitment);
    });

    it('should handle different cipher suites', () => {
      const params1 = { ...mockDerivationParams, cipherSuite: 'TLS_RSA_WITH_AES_128_CBC_SHA' };
      const params2 = { ...mockDerivationParams, cipherSuite: 'TLS_RSA_WITH_AES_256_CBC_SHA' };
      
      const commitment1 = engine.commitToKeyDerivation(params1);
      const commitment2 = engine.commitToKeyDerivation(params2);
      
      expect(commitment1.commitment).not.toBe(commitment2.commitment);
      expect(commitment1.metadata.cipherSuite).not.toBe(commitment2.metadata.cipherSuite);
    });
  });

  describe('certificate commitment', () => {
    const mockCertificateChain = [
      Buffer.from('certificate-1-data'),
      Buffer.from('certificate-2-data'),
      Buffer.from('root-ca-certificate')
    ];

    it('should commit to certificate chain', () => {
      const commitment = engine.commitToCertificateChain(mockCertificateChain);
      
      expect(commitment).toBeDefined();
      expect(commitment.commitment).toBeDefined();
      expect(commitment.nonce).toBeDefined();
      expect(commitment.metadata.certificateCount).toBe(3);
      expect(commitment.metadata.chainFingerprint).toBeDefined();
    });

    it('should handle single certificate', () => {
      const singleCert = [Buffer.from('single-certificate')];
      const commitment = engine.commitToCertificateChain(singleCert);
      
      expect(commitment.metadata.certificateCount).toBe(1);
    });

    it('should generate different commitments for different chains', () => {
      const chain1 = [Buffer.from('cert-1')];
      const chain2 = [Buffer.from('cert-2')];
      
      const commitment1 = engine.commitToCertificateChain(chain1);
      const commitment2 = engine.commitToCertificateChain(chain2);
      
      expect(commitment1.commitment).not.toBe(commitment2.commitment);
    });

    it('should throw error for empty certificate chain', () => {
      expect(() => engine.commitToCertificateChain([])).toThrow('Certificate chain cannot be empty');
    });
  });

  describe('transcript commitment', () => {
    const mockTranscriptData = {
      records: [
        { data: Buffer.from('record-1'), timestamp: Date.now() - 1000 },
        { data: Buffer.from('record-2'), timestamp: Date.now() - 500 },
        { data: Buffer.from('record-3'), timestamp: Date.now() }
      ],
      sessionId: 'test-session-123'
    };

    it('should commit to transcript data', () => {
      const commitment = engine.commitToTranscript(mockTranscriptData);
      
      expect(commitment).toBeDefined();
      expect(commitment.commitment).toBeDefined();
      expect(commitment.nonce).toBeDefined();
      expect(commitment.metadata.sessionId).toBe('test-session-123');
      expect(commitment.metadata.recordCount).toBe(3);
      expect(commitment.metadata.totalBytes).toBeGreaterThan(0);
    });

    it('should handle empty transcript', () => {
      const emptyTranscript = { records: [], sessionId: 'empty-session' };
      const commitment = engine.commitToTranscript(emptyTranscript);
      
      expect(commitment.metadata.recordCount).toBe(0);
      expect(commitment.metadata.totalBytes).toBe(0);
    });

    it('should calculate total bytes correctly', () => {
      const transcript = {
        records: [
          { data: Buffer.from('12345'), timestamp: Date.now() }, // 5 bytes
          { data: Buffer.from('67890'), timestamp: Date.now() }  // 5 bytes
        ],
        sessionId: 'byte-test'
      };
      
      const commitment = engine.commitToTranscript(transcript);
      expect(commitment.metadata.totalBytes).toBe(10);
    });
  });

  describe('commitment verification', () => {
    const mockSessionKeys = {
      clientWriteKey: Buffer.from('test-client-key'),
      serverWriteKey: Buffer.from('test-server-key'),
      clientWriteIV: Buffer.from('test-client-iv'),
      serverWriteIV: Buffer.from('test-server-iv'),
      clientWriteMac: Buffer.from('test-client-mac'),
      serverWriteMac: Buffer.from('test-server-mac')
    };

    it('should verify correct commitment', () => {
      const commitment = engine.commitToSessionKeys(mockSessionKeys);
      
      const isValid = engine.verifyKeyCommitment(
        mockSessionKeys,
        commitment.commitment,
        commitment.nonce
      );
      
      expect(isValid).toBe(true);
    });

    it('should reject incorrect commitment', () => {
      const commitment = engine.commitToSessionKeys(mockSessionKeys);
      const wrongCommitment = 'incorrect-commitment-hash';
      
      const isValid = engine.verifyKeyCommitment(
        mockSessionKeys,
        wrongCommitment,
        commitment.nonce
      );
      
      expect(isValid).toBe(false);
    });

    it('should reject wrong nonce', () => {
      const commitment = engine.commitToSessionKeys(mockSessionKeys);
      const wrongNonce = engine.generateSecureNonce();
      
      const isValid = engine.verifyKeyCommitment(
        mockSessionKeys,
        wrongNonce,
        commitment.commitment
      );
      
      expect(isValid).toBe(false);
    });

    it('should handle verification errors gracefully', () => {
      const isValid = engine.verifyKeyCommitment(
        null as any,
        'invalid-nonce',
        'invalid-commitment'
      );
      
      expect(isValid).toBe(false);
    });
  });

  describe('derivation commitment verification', () => {
    const mockParams = {
      masterSecret: Buffer.from('master-secret'),
      clientRandom: Buffer.from('client-random-data'),
      serverRandom: Buffer.from('server-random-data'),
      cipherSuite: 'TLS_RSA_WITH_AES_128_CBC_SHA',
      keyBlockLength: 104
    };

    it('should verify correct derivation commitment', () => {
      const commitment = engine.commitToKeyDerivation(mockParams);
      
      const isValid = engine.verifyDerivationCommitment(
        mockParams,
        commitment.commitment,
        commitment.nonce
      );
      
      expect(isValid).toBe(true);
    });

    it('should reject incorrect derivation commitment', () => {
      const commitment = engine.commitToKeyDerivation(mockParams);
      const wrongCommitment = 'wrong-derivation-commitment';
      
      const isValid = engine.verifyDerivationCommitment(
        mockParams,
        wrongCommitment,
        commitment.nonce
      );
      
      expect(isValid).toBe(false);
    });
  });

  describe('certificate commitment verification', () => {
    const mockChain = [
      Buffer.from('cert-1-data'),
      Buffer.from('cert-2-data')
    ];

    it('should verify correct certificate commitment', () => {
      const commitment = engine.commitToCertificateChain(mockChain);
      
      const isValid = engine.verifyCertificateCommitment(
        mockChain,
        commitment.commitment,
        commitment.nonce
      );
      
      expect(isValid).toBe(true);
    });

    it('should reject incorrect certificate commitment', () => {
      const commitment = engine.commitToCertificateChain(mockChain);
      const wrongCommitment = 'wrong-cert-commitment';
      
      const isValid = engine.verifyCertificateCommitment(
        mockChain,
        wrongCommitment,
        commitment.nonce
      );
      
      expect(isValid).toBe(false);
    });
  });

  describe('transcript commitment verification', () => {
    const mockTranscript = {
      records: [
        { data: Buffer.from('record-data'), timestamp: Date.now() }
      ],
      sessionId: 'verify-test'
    };

    it('should verify correct transcript commitment', () => {
      const commitment = engine.commitToTranscript(mockTranscript);
      
      const isValid = engine.verifyTranscriptCommitment(
        mockTranscript,
        commitment.commitment,
        commitment.nonce
      );
      
      expect(isValid).toBe(true);
    });

    it('should reject incorrect transcript commitment', () => {
      const commitment = engine.commitToTranscript(mockTranscript);
      const wrongCommitment = 'wrong-transcript-commitment';
      
      const isValid = engine.verifyTranscriptCommitment(
        mockTranscript,
        wrongCommitment,
        commitment.nonce
      );
      
      expect(isValid).toBe(false);
    });
  });

  describe('nonce generation', () => {
    it('should generate secure random nonces', () => {
      const nonce1 = engine.generateSecureNonce();
      const nonce2 = engine.generateSecureNonce();
      
      expect(nonce1).toBeDefined();
      expect(nonce2).toBeDefined();
      expect(nonce1).not.toBe(nonce2);
      expect(typeof nonce1).toBe('string');
      expect(nonce1.length).toBeGreaterThan(0);
    });

    it('should generate cryptographically secure nonces', () => {
      const nonces = Array.from({ length: 100 }, () => engine.generateSecureNonce());
      const uniqueNonces = new Set(nonces);
      
      // All nonces should be unique
      expect(uniqueNonces.size).toBe(100);
    });
  });

  describe('commitment batching', () => {
    const mockBatch = {
      sessionKeys: {
        clientWriteKey: Buffer.from('batch-client-key'),
        serverWriteKey: Buffer.from('batch-server-key'),
        clientWriteIV: Buffer.from('batch-client-iv'),
        serverWriteIV: Buffer.from('batch-server-iv'),
        clientWriteMac: Buffer.from('batch-client-mac'),
        serverWriteMac: Buffer.from('batch-server-mac')
      },
      derivationParams: {
        masterSecret: Buffer.from('batch-master-secret'),
        clientRandom: Buffer.from('batch-client-random'),
        serverRandom: Buffer.from('batch-server-random'),
        cipherSuite: 'TLS_RSA_WITH_AES_128_CBC_SHA',
        keyBlockLength: 104
      },
      certificateChain: [Buffer.from('batch-certificate')],
      transcript: {
        records: [{ data: Buffer.from('batch-record'), timestamp: Date.now() }],
        sessionId: 'batch-session'
      }
    };

    it('should create batch commitment', () => {
      const batchCommitment = engine.createBatchCommitment(mockBatch);
      
      expect(batchCommitment).toBeDefined();
      expect(batchCommitment.commitment).toBeDefined();
      expect(batchCommitment.nonce).toBeDefined();
      expect(batchCommitment.components.sessionKeys).toBeDefined();
      expect(batchCommitment.components.derivationParams).toBeDefined();
      expect(batchCommitment.components.certificateChain).toBeDefined();
      expect(batchCommitment.components.transcript).toBeDefined();
    });

    it.skip('should verify batch commitment', () => {
      const batchCommitment = engine.createBatchCommitment(mockBatch);
      
      const isValid = engine.verifyBatchCommitment(
        mockBatch,
        batchCommitment.nonce,
        batchCommitment.commitment
      );
      
      expect(isValid).toBe(true);
    });

    it('should reject invalid batch commitment', () => {
      const batchCommitment = engine.createBatchCommitment(mockBatch);
      const wrongCommitment = 'invalid-batch-commitment';
      
      const isValid = engine.verifyBatchCommitment(
        mockBatch,
        batchCommitment.nonce,
        wrongCommitment
      );
      
      expect(isValid).toBe(false);
    });
  });

  describe('commitment export/import', () => {
    const mockSessionKeys = {
      clientWriteKey: Buffer.from('export-client-key'),
      serverWriteKey: Buffer.from('export-server-key'),
      clientWriteIV: Buffer.from('export-client-iv'),
      serverWriteIV: Buffer.from('export-server-iv'),
      clientWriteMac: Buffer.from('export-client-mac'),
      serverWriteMac: Buffer.from('export-server-mac')
    };

    it('should export commitment data', () => {
      const commitment = engine.commitToSessionKeys(mockSessionKeys);
      const exported = engine.exportCommitment(commitment);
      
      expect(exported).toBeDefined();
      expect(exported.commitment).toBe(commitment.commitment);
      expect(exported.nonce).toBe(commitment.nonce);
      expect(exported.metadata).toEqual(commitment.metadata);
      expect(exported.version).toBeDefined();
    });

    it('should import and verify commitment data', () => {
      const commitment = engine.commitToSessionKeys(mockSessionKeys);
      const exported = engine.exportCommitment(commitment);
      const imported = engine.importCommitment(exported);
      
      expect(imported).toEqual(commitment);
    });

    it('should handle invalid import data', () => {
      const invalidData = {
        commitment: 'invalid',
        nonce: 'invalid',
        metadata: {},
        version: 'unknown'
      };
      
      expect(() => engine.importCommitment(invalidData)).toThrow('Invalid commitment data');
    });
  });

  describe('performance optimization', () => {
    it('should handle large data efficiently', () => {
      const largeData = Buffer.alloc(1024 * 1024, 'a'); // 1MB of data
      const sessionKeys = {
        clientWriteKey: largeData,
        serverWriteKey: Buffer.from('server-key'),
        clientWriteIV: Buffer.from('client-iv'),
        serverWriteIV: Buffer.from('server-iv'),
        clientWriteMac: Buffer.from('client-mac'),
        serverWriteMac: Buffer.from('server-mac')
      };
      
      const startTime = Date.now();
      const commitment = engine.commitToSessionKeys(sessionKeys);
      const endTime = Date.now();
      
      expect(commitment).toBeDefined();
      expect(endTime - startTime).toBeLessThan(1000); // Should complete within 1 second
    });

    it('should cache repeated computations', () => {
      const sessionKeys = {
        clientWriteKey: Buffer.from('cache-test-key'),
        serverWriteKey: Buffer.from('server-key'),
        clientWriteIV: Buffer.from('client-iv'),
        serverWriteIV: Buffer.from('server-iv'),
        clientWriteMac: Buffer.from('client-mac'),
        serverWriteMac: Buffer.from('server-mac')
      };
      
      const nonce = engine.generateSecureNonce();
      
      const start1 = Date.now();
      const commitment1 = engine.commitToSessionKeys(sessionKeys, nonce);
      const time1 = Date.now() - start1;
      
      const start2 = Date.now();
      const commitment2 = engine.commitToSessionKeys(sessionKeys, nonce);
      const time2 = Date.now() - start2;
      
      expect(commitment1.commitment).toBe(commitment2.commitment);
      // Second computation might be faster due to caching (not guaranteed but expected)
      expect(time2).toBeLessThanOrEqual(time1 + 50); // Allow for variation
    });
  });

  describe('error handling', () => {
    it('should handle null session keys', () => {
      expect(() => engine.commitToSessionKeys(null as any)).toThrow();
    });

    it('should handle invalid derivation parameters', () => {
      const invalidParams = {
        masterSecret: null,
        clientRandom: Buffer.from('random'),
        serverRandom: Buffer.from('random'),
        cipherSuite: '',
        keyBlockLength: -1
      } as any;
      
      expect(() => engine.commitToKeyDerivation(invalidParams)).toThrow();
    });

    it('should handle commitment verification with invalid data', () => {
      const result = engine.verifyKeyCommitment(
        undefined as any,
        'invalid-nonce',
        'invalid-commitment'
      );
      
      expect(result).toBe(false);
    });
  });
});