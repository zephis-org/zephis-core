import { describe, it, expect, beforeEach } from 'vitest';
import { HKDF } from '../../src/cryptography/hkdf';

describe('HKDF', () => {
  let hkdf: HKDF;

  beforeEach(() => {
    hkdf = new HKDF();
  });

  describe('extract', () => {
    it('should extract PRK from IKM', () => {
      const ikm = generateTestBuffer(32);
      const prk = hkdf.extract(ikm);
      
      expect(prk).toBeInstanceOf(Buffer);
      expect(prk.length).toBe(32); // SHA-256 output length
    });

    it('should use salt if provided', () => {
      const ikm = generateTestBuffer(32);
      const salt = generateTestBuffer(16);
      
      const prk1 = hkdf.extract(ikm);
      const prk2 = hkdf.extract(ikm, salt);
      
      expect(prk1.equals(prk2)).toBe(false);
    });

    it('should handle different hash algorithms', () => {
      const ikm = generateTestBuffer(32);
      
      const prkSha256 = hkdf.extract(ikm, undefined, 'sha256');
      const prkSha512 = hkdf.extract(ikm, undefined, 'sha512');
      
      expect(prkSha256.length).toBe(32);
      expect(prkSha512.length).toBe(64);
      expect(prkSha256.equals(prkSha512.subarray(0, 32))).toBe(false);
    });

    it('should be deterministic', () => {
      const ikm = generateTestBuffer(32);
      const salt = generateTestBuffer(16);
      
      const prk1 = hkdf.extract(ikm, salt);
      const prk2 = hkdf.extract(ikm, salt);
      
      expect(prk1.equals(prk2)).toBe(true);
    });
  });

  describe('expand', () => {
    it('should expand PRK to desired length', () => {
      const prk = generateTestBuffer(32);
      const length = 64;
      
      const okm = hkdf.expand(prk, length);
      
      expect(okm).toBeInstanceOf(Buffer);
      expect(okm.length).toBe(length);
    });

    it('should use info parameter if provided', () => {
      const prk = generateTestBuffer(32);
      const info = Buffer.from('test info');
      const length = 32;
      
      const okm1 = hkdf.expand(prk, length);
      const okm2 = hkdf.expand(prk, length, info);
      
      expect(okm1.equals(okm2)).toBe(false);
    });

    it('should handle different output lengths', () => {
      const prk = generateTestBuffer(32);
      
      const okm16 = hkdf.expand(prk, 16);
      const okm32 = hkdf.expand(prk, 32);
      const okm64 = hkdf.expand(prk, 64);
      
      expect(okm16.length).toBe(16);
      expect(okm32.length).toBe(32);
      expect(okm64.length).toBe(64);
    });

    it('should reject length > 255 * hash_len', () => {
      const prk = generateTestBuffer(32);
      const maxLength = 255 * 32 + 1; // One byte over limit for SHA-256
      
      expect(() => hkdf.expand(prk, maxLength)).toThrow();
    });

    it('should be deterministic', () => {
      const prk = generateTestBuffer(32);
      const info = Buffer.from('test info');
      const length = 48;
      
      const okm1 = hkdf.expand(prk, length, info);
      const okm2 = hkdf.expand(prk, length, info);
      
      expect(okm1.equals(okm2)).toBe(true);
    });
  });

  describe('derive', () => {
    it('should perform full HKDF derivation', () => {
      const ikm = generateTestBuffer(32);
      const salt = generateTestBuffer(16);
      const info = Buffer.from('application info');
      const length = 42;
      
      const okm = hkdf.derive({ ikm, salt, info, length });
      
      expect(okm).toBeInstanceOf(Buffer);
      expect(okm.length).toBe(length);
    });

    it('should handle minimal parameters', () => {
      const ikm = generateTestBuffer(32);
      const length = 32;
      
      const okm = hkdf.derive({ ikm, length });
      
      expect(okm).toBeInstanceOf(Buffer);
      expect(okm.length).toBe(length);
    });

    it('should be equivalent to extract + expand', () => {
      const ikm = generateTestBuffer(32);
      const salt = generateTestBuffer(16);
      const info = Buffer.from('test info');
      const length = 48;
      
      const okm1 = hkdf.derive({ ikm, salt, info, length });
      
      const prk = hkdf.extract(ikm, salt);
      const okm2 = hkdf.expand(prk, length, info);
      
      expect(okm1.equals(okm2)).toBe(true);
    });
  });

  describe('deriveTLSKeys', () => {
    it('should derive TLS key block', () => {
      const masterSecret = generateTestBuffer(48);
      const clientRandom = generateTestBuffer(32);
      const serverRandom = generateTestBuffer(32);
      const keyBlockLength = 104;
      
      const keyBlock = hkdf.deriveTLSKeys(masterSecret, clientRandom, serverRandom, keyBlockLength);
      
      expect(keyBlock).toBeInstanceOf(Buffer);
      expect(keyBlock.length).toBe(keyBlockLength);
    });

    it('should be deterministic for same inputs', () => {
      const masterSecret = generateTestBuffer(48);
      const clientRandom = generateTestBuffer(32);
      const serverRandom = generateTestBuffer(32);
      const keyBlockLength = 104;
      
      const keyBlock1 = hkdf.deriveTLSKeys(masterSecret, clientRandom, serverRandom, keyBlockLength);
      const keyBlock2 = hkdf.deriveTLSKeys(masterSecret, clientRandom, serverRandom, keyBlockLength);
      
      expect(keyBlock1.equals(keyBlock2)).toBe(true);
    });

    it('should produce different results for different randoms', () => {
      const masterSecret = generateTestBuffer(48);
      const clientRandom1 = generateTestBuffer(32);
      const clientRandom2 = generateTestBuffer(32);
      const serverRandom = generateTestBuffer(32);
      const keyBlockLength = 104;
      
      const keyBlock1 = hkdf.deriveTLSKeys(masterSecret, clientRandom1, serverRandom, keyBlockLength);
      const keyBlock2 = hkdf.deriveTLSKeys(masterSecret, clientRandom2, serverRandom, keyBlockLength);
      
      expect(keyBlock1.equals(keyBlock2)).toBe(false);
    });
  });

  describe('deriveMasterSecret', () => {
    it('should derive 48-byte master secret', () => {
      const preMasterSecret = generateTestBuffer(48);
      const clientRandom = generateTestBuffer(32);
      const serverRandom = generateTestBuffer(32);
      
      const masterSecret = hkdf.deriveMasterSecret(preMasterSecret, clientRandom, serverRandom);
      
      expect(masterSecret).toBeInstanceOf(Buffer);
      expect(masterSecret.length).toBe(48);
    });

    it('should be deterministic', () => {
      const preMasterSecret = generateTestBuffer(48);
      const clientRandom = generateTestBuffer(32);
      const serverRandom = generateTestBuffer(32);
      
      const master1 = hkdf.deriveMasterSecret(preMasterSecret, clientRandom, serverRandom);
      const master2 = hkdf.deriveMasterSecret(preMasterSecret, clientRandom, serverRandom);
      
      expect(master1.equals(master2)).toBe(true);
    });

    it('should produce different secrets for different inputs', () => {
      const preMasterSecret1 = generateTestBuffer(48);
      const preMasterSecret2 = generateTestBuffer(48);
      const clientRandom = generateTestBuffer(32);
      const serverRandom = generateTestBuffer(32);
      
      const master1 = hkdf.deriveMasterSecret(preMasterSecret1, clientRandom, serverRandom);
      const master2 = hkdf.deriveMasterSecret(preMasterSecret2, clientRandom, serverRandom);
      
      expect(master1.equals(master2)).toBe(false);
    });
  });

  describe('deriveFinishedKeys', () => {
    it('should derive client finished key', () => {
      const masterSecret = generateTestBuffer(48);
      const handshakeHash = generateTestBuffer(32);
      
      const finishedKey = hkdf.deriveFinishedKeys(masterSecret, handshakeHash, true);
      
      expect(finishedKey).toBeInstanceOf(Buffer);
      expect(finishedKey.length).toBe(12);
    });

    it('should derive server finished key', () => {
      const masterSecret = generateTestBuffer(48);
      const handshakeHash = generateTestBuffer(32);
      
      const finishedKey = hkdf.deriveFinishedKeys(masterSecret, handshakeHash, false);
      
      expect(finishedKey).toBeInstanceOf(Buffer);
      expect(finishedKey.length).toBe(12);
    });

    it('should produce different keys for client vs server', () => {
      const masterSecret = generateTestBuffer(48);
      const handshakeHash = generateTestBuffer(32);
      
      const clientKey = hkdf.deriveFinishedKeys(masterSecret, handshakeHash, true);
      const serverKey = hkdf.deriveFinishedKeys(masterSecret, handshakeHash, false);
      
      expect(clientKey.equals(serverKey)).toBe(false);
    });
  });

  describe('derivePSK', () => {
    it('should derive PSK with default length', () => {
      const sharedSecret = generateTestBuffer(32);
      const clientRandom = generateTestBuffer(32);
      const serverRandom = generateTestBuffer(32);
      
      const psk = hkdf.derivePSK(sharedSecret, clientRandom, serverRandom);
      
      expect(psk).toBeInstanceOf(Buffer);
      expect(psk.length).toBe(32);
    });

    it('should derive PSK with custom length', () => {
      const sharedSecret = generateTestBuffer(32);
      const clientRandom = generateTestBuffer(32);
      const serverRandom = generateTestBuffer(32);
      const customLength = 64;
      
      const psk = hkdf.derivePSK(sharedSecret, clientRandom, serverRandom, customLength);
      
      expect(psk.length).toBe(customLength);
    });
  });

  describe('deriveMultipleKeys', () => {
    it('should derive multiple keys from same IKM', () => {
      const ikm = generateTestBuffer(32);
      const keySpecs = [
        { label: 'encryption key', length: 32 },
        { label: 'mac key', length: 20 },
        { label: 'iv', length: 16 },
      ];
      
      const keys = hkdf.deriveMultipleKeys(ikm, keySpecs);
      
      expect(keys).toHaveLength(3);
      expect(keys[0].length).toBe(32);
      expect(keys[1].length).toBe(20);
      expect(keys[2].length).toBe(16);
    });

    it('should produce different keys for different labels', () => {
      const ikm = generateTestBuffer(32);
      const keySpecs = [
        { label: 'key1', length: 32 },
        { label: 'key2', length: 32 },
      ];
      
      const keys = hkdf.deriveMultipleKeys(ikm, keySpecs);
      
      expect(keys[0].equals(keys[1])).toBe(false);
    });

    it('should handle context in key derivation', () => {
      const ikm = generateTestBuffer(32);
      const context = Buffer.from('session-123');
      const keySpecs = [
        { label: 'test key', context, length: 32 },
      ];
      
      const keys1 = hkdf.deriveMultipleKeys(ikm, keySpecs);
      const keysNoContext = hkdf.deriveMultipleKeys(ikm, [
        { label: 'test key', length: 32 }
      ]);
      
      expect(keys1[0].equals(keysNoContext[0])).toBe(false);
    });
  });

  describe('verifyKeyDerivation', () => {
    it('should verify correct key derivation', () => {
      const ikm = generateTestBuffer(32);
      const salt = generateTestBuffer(16);
      const info = Buffer.from('test info');
      const length = 32;
      
      const params = { ikm, salt, info, length };
      const derivedKey = hkdf.derive(params);
      
      const isValid = hkdf.verifyKeyDerivation(params, derivedKey);
      expect(isValid).toBe(true);
    });

    it('should reject incorrect key derivation', () => {
      const ikm = generateTestBuffer(32);
      const params = { ikm, length: 32 };
      const wrongKey = generateTestBuffer(32);
      
      const isValid = hkdf.verifyKeyDerivation(params, wrongKey);
      expect(isValid).toBe(false);
    });

    it('should handle verification errors gracefully', () => {
      const params = { ikm: generateTestBuffer(32), length: 32 };
      const invalidKey = Buffer.from('invalid');
      
      const isValid = hkdf.verifyKeyDerivation(params, invalidKey);
      expect(isValid).toBe(false);
    });
  });

  describe('constantTimeCompare', () => {
    it('should return true for equal buffers', () => {
      const buffer1 = generateTestBuffer(32);
      const buffer2 = Buffer.from(buffer1);
      
      const result = hkdf.constantTimeCompare(buffer1, buffer2);
      expect(result).toBe(true);
    });

    it('should return false for different buffers', () => {
      const buffer1 = generateTestBuffer(32);
      const buffer2 = generateTestBuffer(32);
      
      const result = hkdf.constantTimeCompare(buffer1, buffer2);
      expect(result).toBe(false);
    });

    it('should return false for different length buffers', () => {
      const buffer1 = generateTestBuffer(32);
      const buffer2 = generateTestBuffer(16);
      
      const result = hkdf.constantTimeCompare(buffer1, buffer2);
      expect(result).toBe(false);
    });
  });

  describe('secureRandomBytes', () => {
    it('should generate random bytes of correct length', () => {
      const length = 32;
      const randomBytes = hkdf.secureRandomBytes(length);
      
      expect(randomBytes).toBeInstanceOf(Buffer);
      expect(randomBytes.length).toBe(length);
    });

    it('should generate different bytes each time', () => {
      const bytes1 = hkdf.secureRandomBytes(32);
      const bytes2 = hkdf.secureRandomBytes(32);
      
      expect(bytes1.equals(bytes2)).toBe(false);
    });
  });

  describe('zeroMemory', () => {
    it('should zero out buffer contents', () => {
      const buffer = generateTestBuffer(32);
      const originalSum = buffer.reduce((sum, byte) => sum + byte, 0);
      
      expect(originalSum).toBeGreaterThan(0); // Ensure it's not already zero
      
      hkdf.zeroMemory(buffer);
      
      const zeroedSum = buffer.reduce((sum, byte) => sum + byte, 0);
      expect(zeroedSum).toBe(0);
    });

    it('should handle empty buffer', () => {
      const emptyBuffer = Buffer.alloc(0);
      
      expect(() => hkdf.zeroMemory(emptyBuffer)).not.toThrow();
    });
  });
});