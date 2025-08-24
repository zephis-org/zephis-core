import * as crypto from 'crypto';

export interface TranscriptRecord {
  type: number;
  version: number;
  data: Buffer;
  timestamp: number;
  sequenceNumber: number;
}

export interface TranscriptHash {
  recordHashes: string[];
  cumulativeHash: string;
  merkleRoot: string;
  totalRecords: number;
  totalBytes: number;
}

export interface HashCommitment {
  commitment: string;
  salt: string;
  metadata: {
    algorithm: string;
    recordCount: number;
    timestamp: number;
  };
}

export class TranscriptHashEngine {
  private records: TranscriptRecord[] = [];
  private cumulativeHasher: crypto.Hash;
  private recordHashes: string[] = [];

  constructor() {
    this.cumulativeHasher = crypto.createHash('sha256');
  }

  public addRecord(record: TranscriptRecord): string {
    // Hash individual record
    const recordHash = this.hashRecord(record);
    this.recordHashes.push(recordHash);
    
    // Update cumulative hash
    this.cumulativeHasher.update(Buffer.from(recordHash, 'hex'));
    
    // Store record
    this.records.push({ ...record });
    
    return recordHash;
  }

  private hashRecord(record: TranscriptRecord): string {
    const recordHasher = crypto.createHash('sha256');
    
    // Hash record metadata
    recordHasher.update(Buffer.from([
      record.type,
      (record.version >> 8) & 0xff,
      record.version & 0xff
    ]));
    
    // Hash timestamp and sequence number
    const timestampBuffer = Buffer.alloc(8);
    timestampBuffer.writeBigUInt64BE(BigInt(record.timestamp));
    recordHasher.update(timestampBuffer);
    
    const seqBuffer = Buffer.alloc(4);
    seqBuffer.writeUInt32BE(record.sequenceNumber);
    recordHasher.update(seqBuffer);
    
    // Hash data
    recordHasher.update(record.data);
    
    return recordHasher.digest('hex');
  }

  public getTranscriptHash(): TranscriptHash {
    const merkleRoot = this.buildMerkleRoot(this.recordHashes);
    const cumulativeHash = this.cumulativeHasher.digest('hex');
    const totalBytes = this.records.reduce((sum, record) => sum + record.data.length, 0);
    
    return {
      recordHashes: [...this.recordHashes],
      cumulativeHash,
      merkleRoot,
      totalRecords: this.records.length,
      totalBytes
    };
  }

  private buildMerkleRoot(hashes: string[]): string {
    if (hashes.length === 0) return '';
    if (hashes.length === 1) return hashes[0];
    
    let currentLevel = hashes;
    
    while (currentLevel.length > 1) {
      const nextLevel: string[] = [];
      
      for (let i = 0; i < currentLevel.length; i += 2) {
        const left = currentLevel[i];
        const right = i + 1 < currentLevel.length ? currentLevel[i + 1] : left;
        
        const pairHash = crypto.createHash('sha256');
        pairHash.update(Buffer.from(left, 'hex'));
        pairHash.update(Buffer.from(right, 'hex'));
        nextLevel.push(pairHash.digest('hex'));
      }
      
      currentLevel = nextLevel;
    }
    
    return currentLevel[0];
  }

  public generateHashCommitment(transcriptHash: TranscriptHash): HashCommitment {
    const salt = crypto.randomBytes(32).toString('hex');
    
    const commitmentHasher = crypto.createHash('sha256');
    commitmentHasher.update(transcriptHash.cumulativeHash);
    commitmentHasher.update(transcriptHash.merkleRoot);
    commitmentHasher.update(Buffer.from(salt, 'hex'));
    
    const commitment = commitmentHasher.digest('hex');
    
    return {
      commitment,
      salt,
      metadata: {
        algorithm: 'SHA-256',
        recordCount: transcriptHash.totalRecords,
        timestamp: Date.now()
      }
    };
  }

  public verifyHashCommitment(
    transcriptHash: TranscriptHash,
    commitment: HashCommitment
  ): boolean {
    try {
      const expectedCommitmentHasher = crypto.createHash('sha256');
      expectedCommitmentHasher.update(transcriptHash.cumulativeHash);
      expectedCommitmentHasher.update(transcriptHash.merkleRoot);
      expectedCommitmentHasher.update(Buffer.from(commitment.salt, 'hex'));
      
      const expectedCommitment = expectedCommitmentHasher.digest('hex');
      
      return expectedCommitment === commitment.commitment;
    } catch (error) {
      return false;
    }
  }

  public generateMerkleProof(recordIndex: number): string[] | null {
    if (recordIndex < 0 || recordIndex >= this.recordHashes.length) {
      return null;
    }
    
    const proof: string[] = [];
    let currentIndex = recordIndex;
    let currentLevel = this.recordHashes;
    
    while (currentLevel.length > 1) {
      const siblingIndex = currentIndex % 2 === 0 ? currentIndex + 1 : currentIndex - 1;
      
      if (siblingIndex < currentLevel.length) {
        proof.push(currentLevel[siblingIndex]);
      }
      
      // Build next level
      const nextLevel: string[] = [];
      for (let i = 0; i < currentLevel.length; i += 2) {
        const left = currentLevel[i];
        const right = i + 1 < currentLevel.length ? currentLevel[i + 1] : left;
        
        const pairHash = crypto.createHash('sha256');
        pairHash.update(Buffer.from(left, 'hex'));
        pairHash.update(Buffer.from(right, 'hex'));
        nextLevel.push(pairHash.digest('hex'));
      }
      
      currentLevel = nextLevel;
      currentIndex = Math.floor(currentIndex / 2);
    }
    
    return proof;
  }

  public verifyMerkleProof(
    recordHash: string,
    recordIndex: number,
    merkleProof: string[],
    merkleRoot: string
  ): boolean {
    try {
      let currentHash = recordHash;
      let currentIndex = recordIndex;
      
      for (const siblingHash of merkleProof) {
        const pairHash = crypto.createHash('sha256');
        
        if (currentIndex % 2 === 0) {
          pairHash.update(Buffer.from(currentHash, 'hex'));
          pairHash.update(Buffer.from(siblingHash, 'hex'));
        } else {
          pairHash.update(Buffer.from(siblingHash, 'hex'));
          pairHash.update(Buffer.from(currentHash, 'hex'));
        }
        
        currentHash = pairHash.digest('hex');
        currentIndex = Math.floor(currentIndex / 2);
      }
      
      return currentHash === merkleRoot;
    } catch (error) {
      return false;
    }
  }

  public generateSelectiveHashProof(recordIndices: number[]): {
    selectedHashes: string[];
    merkleProofs: string[][];
    merkleRoot: string;
  } | null {
    if (recordIndices.some(index => index < 0 || index >= this.recordHashes.length)) {
      return null;
    }
    
    const selectedHashes = recordIndices.map(index => this.recordHashes[index]);
    const merkleProofs = recordIndices.map(index => this.generateMerkleProof(index) || []);
    const merkleRoot = this.buildMerkleRoot(this.recordHashes);
    
    return {
      selectedHashes,
      merkleProofs,
      merkleRoot
    };
  }

  public generateIncrementalHash(newRecord: TranscriptRecord): {
    newRecordHash: string;
    updatedCumulativeHash: string;
    previousCumulativeHash: string;
  } {
    const previousCumulativeHash = this.cumulativeHasher.digest('hex');
    const newRecordHash = this.addRecord(newRecord);
    const updatedCumulativeHash = this.cumulativeHasher.digest('hex');
    
    return {
      newRecordHash,
      updatedCumulativeHash,
      previousCumulativeHash
    };
  }

  public batchHashRecords(records: TranscriptRecord[]): {
    batchHash: string;
    individualHashes: string[];
    merkleRoot: string;
  } {
    const individualHashes = records.map(record => this.hashRecord(record));
    const merkleRoot = this.buildMerkleRoot(individualHashes);
    
    const batchHasher = crypto.createHash('sha256');
    individualHashes.forEach(hash => {
      batchHasher.update(Buffer.from(hash, 'hex'));
    });
    
    const batchHash = batchHasher.digest('hex');
    
    return {
      batchHash,
      individualHashes,
      merkleRoot
    };
  }

  public generateHashChain(startHash?: string): {
    chainHash: string;
    links: string[];
  } {
    const links: string[] = [];
    let currentHash = startHash || crypto.randomBytes(32).toString('hex');
    
    for (const recordHash of this.recordHashes) {
      const linkHasher = crypto.createHash('sha256');
      linkHasher.update(Buffer.from(currentHash, 'hex'));
      linkHasher.update(Buffer.from(recordHash, 'hex'));
      
      currentHash = linkHasher.digest('hex');
      links.push(currentHash);
    }
    
    return {
      chainHash: currentHash,
      links
    };
  }

  public verifyHashChain(
    chainHash: string,
    links: string[],
    recordHashes: string[],
    startHash?: string
  ): boolean {
    try {
      let currentHash = startHash || crypto.randomBytes(32).toString('hex');
      
      for (let i = 0; i < recordHashes.length; i++) {
        const linkHasher = crypto.createHash('sha256');
        linkHasher.update(Buffer.from(currentHash, 'hex'));
        linkHasher.update(Buffer.from(recordHashes[i], 'hex'));
        
        currentHash = linkHasher.digest('hex');
        
        if (i < links.length && currentHash !== links[i]) {
          return false;
        }
      }
      
      return currentHash === chainHash;
    } catch (error) {
      return false;
    }
  }

  public getRecordByHash(recordHash: string): TranscriptRecord | null {
    const index = this.recordHashes.indexOf(recordHash);
    return index >= 0 ? this.records[index] : null;
  }

  public reset(): void {
    this.records = [];
    this.recordHashes = [];
    this.cumulativeHasher = crypto.createHash('sha256');
  }

  public exportTranscriptHash(): string {
    const transcriptHash = this.getTranscriptHash();
    return JSON.stringify({
      recordHashes: transcriptHash.recordHashes,
      cumulativeHash: transcriptHash.cumulativeHash,
      merkleRoot: transcriptHash.merkleRoot,
      totalRecords: transcriptHash.totalRecords,
      totalBytes: transcriptHash.totalBytes,
      timestamp: Date.now()
    });
  }

  public importTranscriptHash(hashString: string): boolean {
    try {
      const parsed = JSON.parse(hashString);
      this.recordHashes = parsed.recordHashes || [];
      
      // Reconstruct cumulative hasher state (simplified approach)
      this.cumulativeHasher = crypto.createHash('sha256');
      this.recordHashes.forEach(hash => {
        this.cumulativeHasher.update(Buffer.from(hash, 'hex'));
      });
      
      return true;
    } catch (error) {
      return false;
    }
  }
}