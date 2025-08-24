import { describe, it, expect, beforeEach } from 'vitest';
import { KeyExtraction, type KeyMaterial, type SessionKeys } from '../../src/tls-interceptor/key-extraction';
import * as forge from 'node-forge';

describe('KeyExtraction', () => {
  let keyExtraction: KeyExtraction;

  beforeEach(() => {
    keyExtraction = new KeyExtraction();
  });

  describe('extractKeyMaterial', () => {
    const generateMockClientHello = (): Buffer => {
      // Mock client hello with embedded random (32 bytes at offset 6)
      const clientHello = Buffer.alloc(100);
      const clientRandom = generateTestBuffer(32);
      clientRandom.copy(clientHello, 6);
      return clientHello;
    };

    const generateMockServerHello = (): Buffer => {
      // Mock server hello with embedded random (32 bytes at offset 6) and session ID
      const serverHello = Buffer.alloc(100);
      const serverRandom = generateTestBuffer(32);
      serverRandom.copy(serverHello, 6);
      
      // Session ID length (1 byte at offset 38)
      const sessionIdLength = 16;
      serverHello[38] = sessionIdLength;
      
      // Session ID (16 bytes starting at offset 39)
      const sessionId = generateTestBuffer(sessionIdLength);
      sessionId.copy(serverHello, 39);
      
      return serverHello;
    };

    const generateMockClientKeyExchange = (preMasterSecret: Buffer): Buffer => {
      // Mock client key exchange with encrypted pre-master secret
      const clientKeyExchange = Buffer.alloc(256 + 6); // 6 bytes header + encrypted content
      
      // In real implementation, this would be RSA encrypted
      // For testing, we'll just put the pre-master secret with some padding
      const mockEncrypted = Buffer.concat([Buffer.alloc(200), preMasterSecret]);
      mockEncrypted.copy(clientKeyExchange, 6);
      
      return clientKeyExchange;
    };

    const generateMockPrivateKey = (): forge.pki.rsa.PrivateKey => {
      // Generate a simple RSA key pair for testing
      const keyPair = forge.pki.rsa.generateKeyPair({ bits: 1024, e: 0x10001 });
      return keyPair.privateKey;
    };

    it('should extract key material successfully', () => {
      const clientHello = generateMockClientHello();
      const serverHello = generateMockServerHello();
      const preMasterSecret = generateTestBuffer(48);
      const clientKeyExchange = generateMockClientKeyExchange(preMasterSecret);
      const privateKey = generateMockPrivateKey();

      // Mock the private key decryption for testing
      const originalDecrypt = privateKey.decrypt;
      privateKey.decrypt = () => preMasterSecret.toString('binary');

      const keyMaterial = keyExtraction.extractKeyMaterial(
        clientHello,
        serverHello,
        clientKeyExchange,
        privateKey
      );

      expect(keyMaterial).toBeTruthy();
      expect(keyMaterial?.preMasterSecret).toBeInstanceOf(Buffer);
      expect(keyMaterial?.clientRandom).toBeInstanceOf(Buffer);
      expect(keyMaterial?.serverRandom).toBeInstanceOf(Buffer);
      expect(keyMaterial?.sessionId).toBeInstanceOf(Buffer);

      // Restore original method
      privateKey.decrypt = originalDecrypt;
    });

    it('should handle missing private key', () => {
      const clientHello = generateMockClientHello();
      const serverHello = generateMockServerHello();
      const clientKeyExchange = generateMockClientKeyExchange(generateTestBuffer(48));

      const keyMaterial = keyExtraction.extractKeyMaterial(
        clientHello,
        serverHello,
        clientKeyExchange
      );

      expect(keyMaterial).toBeNull();
    });

    it('should handle invalid client key exchange', () => {
      const clientHello = generateMockClientHello();
      const serverHello = generateMockServerHello();
      const invalidClientKeyExchange = Buffer.alloc(10); // Too small
      const privateKey = generateMockPrivateKey();

      const keyMaterial = keyExtraction.extractKeyMaterial(
        clientHello,
        serverHello,
        invalidClientKeyExchange,
        privateKey
      );

      expect(keyMaterial).toBeNull();
    });
  });

  describe('deriveSessionKeys', () => {
    const createMockKeyMaterial = (): KeyMaterial => ({
      preMasterSecret: generateTestBuffer(48),
      clientRandom: generateTestBuffer(32),
      serverRandom: generateTestBuffer(32),
      sessionId: generateTestBuffer(16),
    });

    it('should derive session keys for AES-128-CBC-SHA', () => {
      const keyMaterial = createMockKeyMaterial();
      const cipherSuite = 'TLS_RSA_WITH_AES_128_CBC_SHA';

      const sessionKeys = keyExtraction.deriveSessionKeys(keyMaterial, cipherSuite);

      expect(sessionKeys).toBeTruthy();
      expect(sessionKeys.masterSecret).toBeInstanceOf(Buffer);
      expect(sessionKeys.masterSecret.length).toBe(48);
      expect(sessionKeys.clientWriteKey).toBeInstanceOf(Buffer);
      expect(sessionKeys.serverWriteKey).toBeInstanceOf(Buffer);
      expect(sessionKeys.clientWriteIV).toBeInstanceOf(Buffer);
      expect(sessionKeys.serverWriteIV).toBeInstanceOf(Buffer);
      expect(sessionKeys.clientWriteMac).toBeInstanceOf(Buffer);
      expect(sessionKeys.serverWriteMac).toBeInstanceOf(Buffer);
    });

    it('should derive session keys for AES-256-CBC-SHA', () => {
      const keyMaterial = createMockKeyMaterial();
      const cipherSuite = 'TLS_RSA_WITH_AES_256_CBC_SHA';

      const sessionKeys = keyExtraction.deriveSessionKeys(keyMaterial, cipherSuite);

      expect(sessionKeys.clientWriteKey.length).toBe(32); // AES-256 key size
      expect(sessionKeys.serverWriteKey.length).toBe(32);
    });

    it('should derive session keys for GCM cipher suite', () => {
      const keyMaterial = createMockKeyMaterial();
      const cipherSuite = 'TLS_RSA_WITH_AES_128_GCM_SHA256';

      const sessionKeys = keyExtraction.deriveSessionKeys(keyMaterial, cipherSuite);

      expect(sessionKeys.clientWriteMac.length).toBe(0); // GCM doesn't use MAC keys
      expect(sessionKeys.serverWriteMac.length).toBe(0);
      expect(sessionKeys.clientWriteIV.length).toBe(4); // GCM fixed IV size
      expect(sessionKeys.serverWriteIV.length).toBe(4);
    });

    it('should produce consistent results', () => {
      const keyMaterial = createMockKeyMaterial();
      const cipherSuite = 'TLS_RSA_WITH_AES_128_CBC_SHA';

      const sessionKeys1 = keyExtraction.deriveSessionKeys(keyMaterial, cipherSuite);
      const sessionKeys2 = keyExtraction.deriveSessionKeys(keyMaterial, cipherSuite);

      expect(sessionKeys1.masterSecret.equals(sessionKeys2.masterSecret)).toBe(true);
      expect(sessionKeys1.clientWriteKey.equals(sessionKeys2.clientWriteKey)).toBe(true);
      expect(sessionKeys1.serverWriteKey.equals(sessionKeys2.serverWriteKey)).toBe(true);
    });

    it('should produce different keys for different key material', () => {
      const keyMaterial1 = createMockKeyMaterial();
      const keyMaterial2 = createMockKeyMaterial();
      const cipherSuite = 'TLS_RSA_WITH_AES_128_CBC_SHA';

      const sessionKeys1 = keyExtraction.deriveSessionKeys(keyMaterial1, cipherSuite);
      const sessionKeys2 = keyExtraction.deriveSessionKeys(keyMaterial2, cipherSuite);

      expect(sessionKeys1.masterSecret.equals(sessionKeys2.masterSecret)).toBe(false);
      expect(sessionKeys1.clientWriteKey.equals(sessionKeys2.clientWriteKey)).toBe(false);
    });
  });

  describe('commitToKeys', () => {
    const createMockSessionKeys = (): SessionKeys => ({
      masterSecret: generateTestBuffer(48),
      clientWriteKey: generateTestBuffer(16),
      serverWriteKey: generateTestBuffer(16),
      clientWriteIV: generateTestBuffer(16),
      serverWriteIV: generateTestBuffer(16),
      clientWriteMac: generateTestBuffer(20),
      serverWriteMac: generateTestBuffer(20),
    });

    it('should generate key commitment', () => {
      const sessionKeys = createMockSessionKeys();
      const commitment = keyExtraction.commitToKeys(sessionKeys);

      expect(commitment).toBeTruthy();
      expect(typeof commitment).toBe('string');
      expect(commitment.length).toBe(64); // SHA-256 hex output
    });

    it('should be deterministic', () => {
      const sessionKeys = createMockSessionKeys();
      
      const commitment1 = keyExtraction.commitToKeys(sessionKeys);
      const commitment2 = keyExtraction.commitToKeys(sessionKeys);

      expect(commitment1).toBe(commitment2);
    });

    it('should produce different commitments for different keys', () => {
      const sessionKeys1 = createMockSessionKeys();
      const sessionKeys2 = createMockSessionKeys();
      
      const commitment1 = keyExtraction.commitToKeys(sessionKeys1);
      const commitment2 = keyExtraction.commitToKeys(sessionKeys2);

      expect(commitment1).not.toBe(commitment2);
    });

    it('should be sensitive to any key change', () => {
      const sessionKeys = createMockSessionKeys();
      const originalCommitment = keyExtraction.commitToKeys(sessionKeys);

      // Modify client write key slightly
      sessionKeys.clientWriteKey[0] = (sessionKeys.clientWriteKey[0] + 1) % 256;
      const modifiedCommitment = keyExtraction.commitToKeys(sessionKeys);

      expect(originalCommitment).not.toBe(modifiedCommitment);
    });
  });

  describe('cipher suite support', () => {
    it('should support all expected cipher suites', () => {
      const supportedSuites = [
        'TLS_RSA_WITH_AES_128_CBC_SHA',
        'TLS_RSA_WITH_AES_256_CBC_SHA',
        'TLS_RSA_WITH_AES_128_CBC_SHA256',
        'TLS_RSA_WITH_AES_256_CBC_SHA256',
        'TLS_RSA_WITH_AES_128_GCM_SHA256',
        'TLS_RSA_WITH_AES_256_GCM_SHA384',
      ];

      const keyMaterial = {
        preMasterSecret: generateTestBuffer(48),
        clientRandom: generateTestBuffer(32),
        serverRandom: generateTestBuffer(32),
        sessionId: generateTestBuffer(16),
      };

      supportedSuites.forEach(cipherSuite => {
        const sessionKeys = keyExtraction.deriveSessionKeys(keyMaterial, cipherSuite);
        expect(sessionKeys).toBeTruthy();
        expect(sessionKeys.masterSecret.length).toBe(48);
      });
    });

    it('should handle unsupported cipher suites gracefully', () => {
      const keyMaterial = {
        preMasterSecret: generateTestBuffer(48),
        clientRandom: generateTestBuffer(32),
        serverRandom: generateTestBuffer(32),
        sessionId: generateTestBuffer(16),
      };

      const unsupportedSuite = 'TLS_UNSUPPORTED_CIPHER';
      const sessionKeys = keyExtraction.deriveSessionKeys(keyMaterial, unsupportedSuite);

      // Should still work but use default key block size
      expect(sessionKeys).toBeTruthy();
      expect(sessionKeys.masterSecret.length).toBe(48);
    });
  });

  describe('key size validation', () => {
    it('should generate correct key sizes for different cipher suites', () => {
      const keyMaterial = {
        preMasterSecret: generateTestBuffer(48),
        clientRandom: generateTestBuffer(32),
        serverRandom: generateTestBuffer(32),
        sessionId: generateTestBuffer(16),
      };

      // Test AES-128
      const aes128Keys = keyExtraction.deriveSessionKeys(
        keyMaterial,
        'TLS_RSA_WITH_AES_128_CBC_SHA'
      );
      expect(aes128Keys.clientWriteKey.length).toBe(16);
      expect(aes128Keys.serverWriteKey.length).toBe(16);

      // Test AES-256
      const aes256Keys = keyExtraction.deriveSessionKeys(
        keyMaterial,
        'TLS_RSA_WITH_AES_256_CBC_SHA'
      );
      expect(aes256Keys.clientWriteKey.length).toBe(32);
      expect(aes256Keys.serverWriteKey.length).toBe(32);
    });

    it('should generate correct MAC key sizes', () => {
      const keyMaterial = {
        preMasterSecret: generateTestBuffer(48),
        clientRandom: generateTestBuffer(32),
        serverRandom: generateTestBuffer(32),
        sessionId: generateTestBuffer(16),
      };

      // SHA-1 MAC (20 bytes)
      const sha1Keys = keyExtraction.deriveSessionKeys(
        keyMaterial,
        'TLS_RSA_WITH_AES_128_CBC_SHA'
      );
      expect(sha1Keys.clientWriteMac.length).toBe(20);
      expect(sha1Keys.serverWriteMac.length).toBe(20);

      // SHA-256 MAC (32 bytes)
      const sha256Keys = keyExtraction.deriveSessionKeys(
        keyMaterial,
        'TLS_RSA_WITH_AES_128_CBC_SHA256'
      );
      expect(sha256Keys.clientWriteMac.length).toBe(32);
      expect(sha256Keys.serverWriteMac.length).toBe(32);

      // GCM (no MAC keys)
      const gcmKeys = keyExtraction.deriveSessionKeys(
        keyMaterial,
        'TLS_RSA_WITH_AES_128_GCM_SHA256'
      );
      expect(gcmKeys.clientWriteMac.length).toBe(0);
      expect(gcmKeys.serverWriteMac.length).toBe(0);
    });

    it('should generate correct IV sizes', () => {
      const keyMaterial = {
        preMasterSecret: generateTestBuffer(48),
        clientRandom: generateTestBuffer(32),
        serverRandom: generateTestBuffer(32),
        sessionId: generateTestBuffer(16),
      };

      // CBC mode (16 bytes IV)
      const cbcKeys = keyExtraction.deriveSessionKeys(
        keyMaterial,
        'TLS_RSA_WITH_AES_128_CBC_SHA'
      );
      expect(cbcKeys.clientWriteIV.length).toBe(16);
      expect(cbcKeys.serverWriteIV.length).toBe(16);

      // GCM mode (4 bytes fixed IV)
      const gcmKeys = keyExtraction.deriveSessionKeys(
        keyMaterial,
        'TLS_RSA_WITH_AES_128_GCM_SHA256'
      );
      expect(gcmKeys.clientWriteIV.length).toBe(4);
      expect(gcmKeys.serverWriteIV.length).toBe(4);
    });
  });
});