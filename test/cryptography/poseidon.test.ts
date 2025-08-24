import { describe, it, expect, beforeEach } from 'vitest';
import { PoseidonHasher } from '../../src/cryptography/poseidon';
import BN from 'bn.js';

describe('PoseidonHasher', () => {
  let hasher: PoseidonHasher;

  beforeEach(() => {
    hasher = new PoseidonHasher();
  });

  describe('hash', () => {
    it('should hash string inputs consistently', () => {
      const inputs = ['123', '456', '789'];
      const hash1 = hasher.hash(inputs);
      const hash2 = hasher.hash(inputs);
      
      expect(hash1).toBe(hash2);
      expect(hash1).toBeTruthy();
    });

    it('should hash number inputs', () => {
      const inputs = [1, 2, 3, 4, 5];
      const hash = hasher.hash(inputs);
      
      expect(hash).toBeTruthy();
      expect(typeof hash).toBe('string');
    });

    it('should hash BN inputs', () => {
      const inputs = [new BN(100), new BN(200), new BN(300)];
      const hash = hasher.hash(inputs);
      
      expect(hash).toBeTruthy();
      expect(typeof hash).toBe('string');
    });

    it('should produce different hashes for different inputs', () => {
      const hash1 = hasher.hash(['input1']);
      const hash2 = hasher.hash(['input2']);
      
      expect(hash1).not.toBe(hash2);
    });

    it('should handle empty input array', () => {
      expect(() => hasher.hash([])).toThrow();
    });
  });

  describe('hashBuffer', () => {
    it('should hash buffer consistently', () => {
      const buffer = generateTestBuffer(32);
      const hash1 = hasher.hashBuffer(buffer);
      const hash2 = hasher.hashBuffer(buffer);
      
      expect(hash1).toBe(hash2);
      expect(hash1).toBeTruthy();
    });

    it('should handle different buffer sizes', () => {
      const small = generateTestBuffer(16);
      const large = generateTestBuffer(64);
      
      const hash1 = hasher.hashBuffer(small);
      const hash2 = hasher.hashBuffer(large);
      
      expect(hash1).not.toBe(hash2);
      expect(hash1).toBeTruthy();
      expect(hash2).toBeTruthy();
    });

    it('should handle empty buffer', () => {
      const emptyBuffer = Buffer.alloc(0);
      const hash = hasher.hashBuffer(emptyBuffer);
      
      expect(hash).toBeTruthy();
    });
  });

  describe('hashStrings', () => {
    it('should hash string arrays consistently', () => {
      const strings = ['hello', 'world', 'zephis'];
      const hash1 = hasher.hashStrings(strings);
      const hash2 = hasher.hashStrings(strings);
      
      expect(hash1).toBe(hash2);
    });

    it('should be order-sensitive', () => {
      const strings1 = ['a', 'b', 'c'];
      const strings2 = ['c', 'b', 'a'];
      
      const hash1 = hasher.hashStrings(strings1);
      const hash2 = hasher.hashStrings(strings2);
      
      expect(hash1).not.toBe(hash2);
    });

    it('should handle unicode strings', () => {
      const unicodeStrings = ['🔒', '🗝️', '🔐'];
      const hash = hasher.hashStrings(unicodeStrings);
      
      expect(hash).toBeTruthy();
    });
  });

  describe('hashCommitment', () => {
    it('should generate commitment with blinding factor', () => {
      const data = { message: 'secret data' };
      const blindingFactor = new BN(12345);
      
      const commitment = hasher.hashCommitment(data, blindingFactor);
      
      expect(commitment).toBeTruthy();
      expect(typeof commitment).toBe('string');
    });

    it('should produce different commitments with different blinding factors', () => {
      const data = { message: 'secret data' };
      const blind1 = new BN(111);
      const blind2 = new BN(222);
      
      const commitment1 = hasher.hashCommitment(data, blind1);
      const commitment2 = hasher.hashCommitment(data, blind2);
      
      expect(commitment1).not.toBe(commitment2);
    });

    it('should produce different commitments for different data', () => {
      const data1 = { value: 100 };
      const data2 = { value: 200 };
      const blindingFactor = new BN(123);
      
      const commitment1 = hasher.hashCommitment(data1, blindingFactor);
      const commitment2 = hasher.hashCommitment(data2, blindingFactor);
      
      expect(commitment1).not.toBe(commitment2);
    });
  });

  describe('generateCommitment', () => {
    it('should generate commitment with nonce', () => {
      const value = 'test value';
      const nonce = new BN(54321);
      
      const result = hasher.generateCommitment(value, nonce);
      
      expect(result.commitment).toBeTruthy();
      expect(result.nonce).toBe(nonce.toString());
    });

    it('should verify generated commitment', () => {
      const value = 'test value';
      const nonce = new BN(54321);
      
      const { commitment, nonce: nonceStr } = hasher.generateCommitment(value, nonce);
      const isValid = hasher.verifyCommitment(value, nonceStr, commitment);
      
      expect(isValid).toBe(true);
    });

    it('should fail verification with wrong value', () => {
      const value = 'test value';
      const wrongValue = 'wrong value';
      const nonce = new BN(54321);
      
      const { commitment, nonce: nonceStr } = hasher.generateCommitment(value, nonce);
      const isValid = hasher.verifyCommitment(wrongValue, nonceStr, commitment);
      
      expect(isValid).toBe(false);
    });

    it('should fail verification with wrong nonce', () => {
      const value = 'test value';
      const nonce = new BN(54321);
      const wrongNonce = new BN(99999);
      
      const { commitment } = hasher.generateCommitment(value, nonce);
      const isValid = hasher.verifyCommitment(value, wrongNonce.toString(), commitment);
      
      expect(isValid).toBe(false);
    });
  });

  describe('merkleHash', () => {
    it('should hash two values consistently', () => {
      const left = '12345';
      const right = '67890';
      
      const hash1 = hasher.merkleHash(left, right);
      const hash2 = hasher.merkleHash(left, right);
      
      expect(hash1).toBe(hash2);
    });

    it('should maintain order consistency (smaller first)', () => {
      const smaller = '100';
      const larger = '200';
      
      // Should produce same hash regardless of input order
      const hash1 = hasher.merkleHash(smaller, larger);
      const hash2 = hasher.merkleHash(larger, smaller);
      
      expect(hash1).toBe(hash2);
    });

    it('should handle identical values', () => {
      const value = '12345';
      const hash = hasher.merkleHash(value, value);
      
      expect(hash).toBeTruthy();
    });
  });

  describe('buildMerkleRoot', () => {
    it('should build root from single leaf', () => {
      const leaves = ['leaf1'];
      const root = hasher.buildMerkleRoot(leaves);
      
      expect(root).toBe('leaf1');
    });

    it('should build root from two leaves', () => {
      const leaves = ['leaf1', 'leaf2'];
      const root = hasher.buildMerkleRoot(leaves);
      
      expect(root).toBeTruthy();
      expect(root).not.toBe('leaf1');
      expect(root).not.toBe('leaf2');
    });

    it('should build root from multiple leaves', () => {
      const leaves = ['leaf1', 'leaf2', 'leaf3', 'leaf4', 'leaf5'];
      const root = hasher.buildMerkleRoot(leaves);
      
      expect(root).toBeTruthy();
      expect(typeof root).toBe('string');
    });

    it('should produce consistent roots', () => {
      const leaves = ['a', 'b', 'c', 'd'];
      const root1 = hasher.buildMerkleRoot(leaves);
      const root2 = hasher.buildMerkleRoot(leaves);
      
      expect(root1).toBe(root2);
    });

    it('should throw error for empty leaves', () => {
      expect(() => hasher.buildMerkleRoot([])).toThrow();
    });

    it('should produce different roots for different leaf sets', () => {
      const leaves1 = ['a', 'b', 'c'];
      const leaves2 = ['x', 'y', 'z'];
      
      const root1 = hasher.buildMerkleRoot(leaves1);
      const root2 = hasher.buildMerkleRoot(leaves2);
      
      expect(root1).not.toBe(root2);
    });
  });

  describe('generateRandomNonce', () => {
    it('should generate valid field element', () => {
      const nonce = hasher.generateRandomNonce();
      
      expect(nonce).toBeInstanceOf(BN);
      expect(hasher.isValidFieldElement(nonce.toString())).toBe(true);
    });

    it('should generate different nonces', () => {
      const nonce1 = hasher.generateRandomNonce();
      const nonce2 = hasher.generateRandomNonce();
      
      expect(nonce1.eq(nonce2)).toBe(false);
    });

    it('should generate nonces within field size', () => {
      const fieldSize = new BN('21888242871839275222246405745257275088548364400416034343698204186575808495617');
      
      for (let i = 0; i < 10; i++) {
        const nonce = hasher.generateRandomNonce();
        expect(nonce.lt(fieldSize)).toBe(true);
        expect(nonce.gte(new BN(0))).toBe(true);
      }
    });
  });

  describe('isValidFieldElement', () => {
    it('should validate correct field elements', () => {
      expect(hasher.isValidFieldElement('0')).toBe(true);
      expect(hasher.isValidFieldElement('1')).toBe(true);
      expect(hasher.isValidFieldElement('12345')).toBe(true);
    });

    it('should reject elements >= field size', () => {
      const fieldSize = '21888242871839275222246405745257275088548364400416034343698204186575808495617';
      expect(hasher.isValidFieldElement(fieldSize)).toBe(false);
    });

    it('should reject negative numbers', () => {
      expect(hasher.isValidFieldElement('-1')).toBe(false);
    });

    it('should handle invalid strings', () => {
      expect(hasher.isValidFieldElement('invalid')).toBe(false);
      expect(hasher.isValidFieldElement('')).toBe(false);
    });
  });

  describe('field operations', () => {
    it('should add field elements correctly', () => {
      const a = '100';
      const b = '200';
      const result = hasher.addFieldElements(a, b);
      
      expect(result).toBe('300');
    });

    it('should handle modular addition', () => {
      const fieldSize = new BN('21888242871839275222246405745257275088548364400416034343698204186575808495617');
      const a = fieldSize.sub(new BN(1)).toString(); // field_size - 1
      const b = '5';
      const result = hasher.addFieldElements(a, b);
      
      // Should wrap around: (field_size - 1 + 5) % field_size = 4
      expect(result).toBe('4');
    });

    it('should multiply field elements correctly', () => {
      const a = '10';
      const b = '20';
      const result = hasher.mulFieldElements(a, b);
      
      expect(result).toBe('200');
    });

    it('should handle modular multiplication', () => {
      const largeA = '123456789012345678901234567890';
      const largeB = '987654321098765432109876543210';
      const result = hasher.mulFieldElements(largeA, largeB);
      
      expect(result).toBeTruthy();
      expect(hasher.isValidFieldElement(result)).toBe(true);
    });
  });
});