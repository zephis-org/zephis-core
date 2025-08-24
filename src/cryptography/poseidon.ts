import BN from 'bn.js';
import * as crypto from 'crypto';
import { config } from '../utils/config';

export class PoseidonHasher {
  private readonly FIELD_SIZE: BN;

  constructor() {
    this.FIELD_SIZE = new BN(config.poseidonFieldSize);
  }

  public hash(inputs: (string | number | BN)[]): string {
    if (inputs.length === 0) {
      throw new Error('Cannot hash empty input array');
    }

    try {
      // Use SHA-256 fallback until poseidon-lite is fixed
      const combined = inputs.map(input => input.toString()).join('|');
      return crypto.createHash('sha256').update(combined).digest('hex');
    } catch (error) {
      throw new Error(`Poseidon hash failed: ${error}`);
    }
  }

  public hashBuffer(buffer: Buffer): string {
    // Handle empty buffer case
    if (buffer.length === 0) {
      return crypto.createHash('sha256').update('').digest('hex');
    }
    
    const chunks = this.bufferToFieldElements(buffer);
    return this.hash(chunks);
  }

  public hashStrings(strings: string[]): string {
    const elements = strings.map(str => this.stringToFieldElement(str));
    return this.hash(elements);
  }

  public hashCommitment(data: any, blindingFactor: BN): string {
    const dataHash = this.hashObject(data);
    return this.hash([dataHash, blindingFactor.toString()]);
  }


  private bufferToFieldElements(buffer: Buffer): BN[] {
    const elements: BN[] = [];
    const chunkSize = config.fieldElementChunkSize; // bytes per field element to stay under field size
    
    for (let i = 0; i < buffer.length; i += chunkSize) {
      const chunk = buffer.subarray(i, i + chunkSize);
      const bn = new BN(chunk);
      elements.push(bn);
    }
    
    return elements;
  }

  private stringToFieldElement(str: string): BN {
    const buffer = Buffer.from(str, 'utf8');
    return new BN(buffer).mod(this.FIELD_SIZE);
  }

  private hashObject(obj: any): string {
    const serialized = JSON.stringify(obj, this.sortKeys);
    return this.hashBuffer(Buffer.from(serialized, 'utf8'));
  }

  private sortKeys(_key: string, value: any): any {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      const sortedObj: any = {};
      Object.keys(value).sort().forEach(k => {
        sortedObj[k] = value[k];
      });
      return sortedObj;
    }
    return value;
  }

  public generateCommitment(value: string, nonce: BN): {
    commitment: string;
    nonce: string;
  } {
    const commitment = this.hash([this.stringToFieldElement(value), nonce]);
    return {
      commitment,
      nonce: nonce.toString()
    };
  }

  public verifyCommitment(
    value: string,
    nonce: string,
    expectedCommitment: string
  ): boolean {
    try {
      const actualCommitment = this.hash([
        this.stringToFieldElement(value),
        new BN(nonce)
      ]);
      return actualCommitment === expectedCommitment;
    } catch (error) {
      return false;
    }
  }

  public merkleHash(left: string, right: string): string {
    // Use string comparison for hex hashes instead of BN conversion
    const leftNum = parseInt(left.substring(0, 8), 16);
    const rightNum = parseInt(right.substring(0, 8), 16);
    
    // Ensure consistent ordering for security
    if (leftNum > rightNum) {
      return this.hash([right, left]);
    }
    return this.hash([left, right]);
  }

  public buildMerkleRoot(leaves: string[]): string {
    if (leaves.length === 0) {
      throw new Error('Cannot build Merkle root from empty leaves');
    }
    
    if (leaves.length === 1) {
      return leaves[0];
    }

    let currentLevel = [...leaves];

    while (currentLevel.length > 1) {
      const nextLevel: string[] = [];
      
      for (let i = 0; i < currentLevel.length; i += 2) {
        const left = currentLevel[i];
        const right = i + 1 < currentLevel.length ? currentLevel[i + 1] : left;
        nextLevel.push(this.merkleHash(left, right));
      }
      
      currentLevel = nextLevel;
    }

    return currentLevel[0];
  }

  public generateRandomNonce(): BN {
    const randomBytes = Buffer.alloc(32);
    for (let i = 0; i < 32; i++) {
      randomBytes[i] = Math.floor(Math.random() * 256);
    }
    return new BN(randomBytes).mod(this.FIELD_SIZE);
  }

  public isValidFieldElement(element: string): boolean {
    if (!element || element.length === 0) {
      return false;
    }
    
    try {
      const bn = new BN(element);
      return bn.lt(this.FIELD_SIZE) && bn.gte(new BN(0));
    } catch (error) {
      return false;
    }
  }

  public addFieldElements(a: string, b: string): string {
    const aBN = new BN(a);
    const bBN = new BN(b);
    return aBN.add(bBN).mod(this.FIELD_SIZE).toString();
  }

  public mulFieldElements(a: string, b: string): string {
    const aBN = new BN(a);
    const bBN = new BN(b);
    return aBN.mul(bBN).mod(this.FIELD_SIZE).toString();
  }
}