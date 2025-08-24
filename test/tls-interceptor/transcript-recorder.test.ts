import { describe, it, expect, beforeEach } from 'vitest';
import { TranscriptRecorder } from '../../src/tls-interceptor/transcript-recorder';

describe('TranscriptRecorder', () => {
  let recorder: TranscriptRecorder;
  const testSessionCommitment = 'test-session-commitment-123';

  beforeEach(() => {
    recorder = new TranscriptRecorder(testSessionCommitment);
  });

  describe('initialization', () => {
    it('should create recorder with session commitment', () => {
      expect(recorder).toBeDefined();
      expect(recorder).toBeInstanceOf(TranscriptRecorder);
    });

    it('should initialize with empty records', () => {
      expect(recorder.getRecords()).toHaveLength(0);
    });
  });

  describe('recording control', () => {
    it('should start and stop recording', () => {
      expect(() => recorder.startRecording()).not.toThrow();
      expect(() => recorder.stopRecording()).not.toThrow();
    });

    it('should not record when not started', () => {
      const testData = Buffer.from('test data');
      recorder.recordTLSRecord(23, 0x0303, testData);
      
      expect(recorder.getRecords()).toHaveLength(0);
    });

    it('should record when started', () => {
      recorder.startRecording();
      
      const testData = Buffer.from('test data');
      recorder.recordTLSRecord(23, 0x0303, testData);
      
      const records = recorder.getRecords();
      expect(records).toHaveLength(1);
      expect(records[0].type).toBe(23);
      expect(records[0].version).toBe(0x0303);
      expect(records[0].data).toEqual(testData);
    });
  });

  describe('TLS record management', () => {
    beforeEach(() => {
      recorder.startRecording();
    });

    it('should record TLS records with sequence numbers', () => {
      const data1 = Buffer.from('first record');
      const data2 = Buffer.from('second record');
      
      recorder.recordTLSRecord(22, 0x0303, data1); // Handshake
      recorder.recordTLSRecord(23, 0x0303, data2); // Application data
      
      const records = recorder.getRecords();
      expect(records).toHaveLength(2);
      expect(records[0].sequenceNumber).toBe(0);
      expect(records[1].sequenceNumber).toBe(1);
    });

    it('should process application data', () => {
      const appData = Buffer.from('application data test');
      recorder.processApplicationData(appData);
      
      const records = recorder.getRecords();
      expect(records).toHaveLength(1);
      expect(records[0].type).toBe(23); // Application data type
      expect(records[0].version).toBe(0x0303); // TLS 1.2
      expect(records[0].data).toEqual(appData);
    });

    it('should preserve record timestamps', () => {
      const beforeTime = Date.now();
      recorder.recordTLSRecord(23, 0x0303, Buffer.from('test'));
      const afterTime = Date.now();
      
      const records = recorder.getRecords();
      expect(records[0].timestamp).toBeGreaterThanOrEqual(beforeTime);
      expect(records[0].timestamp).toBeLessThanOrEqual(afterTime);
    });
  });

  describe('transcript proof generation', () => {
    beforeEach(() => {
      recorder.startRecording();
    });

    it('should generate transcript proof', () => {
      recorder.recordTLSRecord(23, 0x0303, Buffer.from('test data'));
      
      const proof = recorder.generateTranscriptProof();
      expect(proof).toBeDefined();
      expect(proof.records).toHaveLength(1);
      expect(proof.merkleRoot).toBeDefined();
      expect(proof.merkleProofs).toBeDefined();
      expect(proof.sessionCommitment).toBe(testSessionCommitment);
    });

    it('should generate Merkle tree for multiple records', () => {
      const records = [
        Buffer.from('record1'),
        Buffer.from('record2'),
        Buffer.from('record3'),
        Buffer.from('record4')
      ];

      records.forEach((data, index) => {
        recorder.recordTLSRecord(23, 0x0303, data);
      });
      
      const proof = recorder.generateTranscriptProof();
      expect(proof.merkleRoot).toBeDefined();
      expect(proof.merkleProofs).toHaveLength(4);
      expect(typeof proof.merkleRoot).toBe('string');
    });

    it('should throw error for empty transcript', () => {
      expect(() => recorder.generateTranscriptProof()).toThrow('No records to build Merkle tree');
    });
  });

  describe('Merkle proof verification', () => {
    beforeEach(() => {
      recorder.startRecording();
    });

    it('should verify valid Merkle proof', () => {
      recorder.recordTLSRecord(23, 0x0303, Buffer.from('test data'));
      
      const proof = recorder.generateTranscriptProof();
      const isValid = recorder.verifyMerkleProof(0, proof.merkleProofs[0], proof.merkleRoot);
      
      expect(isValid).toBe(true);
    });

    it('should reject invalid record index', () => {
      recorder.recordTLSRecord(23, 0x0303, Buffer.from('test data'));
      
      const proof = recorder.generateTranscriptProof();
      const isValid = recorder.verifyMerkleProof(10, proof.merkleProofs[0], proof.merkleRoot);
      
      expect(isValid).toBe(false);
    });
  });

  describe('selective revelation', () => {
    beforeEach(() => {
      recorder.startRecording();
    });

    it('should create selective disclosure', () => {
      const records = [
        Buffer.from('public1'),
        Buffer.from('secret1'),
        Buffer.from('public2'),
        Buffer.from('secret2')
      ];

      records.forEach(data => {
        recorder.recordTLSRecord(23, 0x0303, data);
      });
      
      const disclosure = recorder.selectiveReveal([0, 2]); // Reveal only public records
      
      expect(disclosure.revealedRecords).toHaveLength(2);
      expect(disclosure.revealedRecords[0].data).toEqual(Buffer.from('public1'));
      expect(disclosure.revealedRecords[1].data).toEqual(Buffer.from('public2'));
      expect(disclosure.merkleProofs).toHaveLength(2);
      expect(disclosure.merkleRoot).toBeDefined();
    });

    it('should handle out of bounds indices', () => {
      recorder.recordTLSRecord(23, 0x0303, Buffer.from('test'));
      
      expect(() => recorder.selectiveReveal([5])).toThrow('Record index 5 out of bounds');
    });

    it('should handle empty revelation', () => {
      recorder.recordTLSRecord(23, 0x0303, Buffer.from('test'));
      
      const disclosure = recorder.selectiveReveal([]);
      expect(disclosure.revealedRecords).toHaveLength(0);
      expect(disclosure.merkleProofs).toHaveLength(0);
    });
  });

  describe('MAC verification', () => {
    beforeEach(() => {
      recorder.startRecording();
    });

    it('should verify record MAC', () => {
      const record = {
        type: 23,
        version: 0x0303,
        length: 16,
        data: Buffer.from('application-data'),
        timestamp: Date.now(),
        sequenceNumber: 0
      };

      const macKey = Buffer.alloc(32, 1); // Mock MAC key
      
      const isValid = recorder.verifyRecordMAC(record, macKey, 0);
      expect(typeof isValid).toBe('boolean');
      expect(isValid).toBe(true); // Should succeed with proper MAC key
    });

    it('should handle MAC verification errors', () => {
      const record = {
        type: 23,
        version: 0x0303,
        length: 10,
        data: Buffer.from('test-data-'),
        timestamp: Date.now(),
        sequenceNumber: 0
      };

      const result = recorder.verifyRecordMAC(record, null as any, 0);
      expect(result).toBe(false);
    });
  });

  describe('transcript integrity', () => {
    beforeEach(() => {
      recorder.startRecording();
    });

    it('should provide transcript integrity proof', () => {
      const records = [
        Buffer.from('data1'),
        Buffer.from('data2')
      ];

      records.forEach(data => {
        recorder.recordTLSRecord(23, 0x0303, data);
      });
      
      const integrityProof = recorder.getTranscriptIntegrityProof();
      expect(integrityProof.totalRecords).toBe(2);
      expect(integrityProof.totalBytes).toBeGreaterThan(0);
      expect(integrityProof.merkleRoot).toBeDefined();
      expect(integrityProof.sessionCommitment).toBe(testSessionCommitment);
      expect(integrityProof.firstRecordTimestamp).toBeDefined();
      expect(integrityProof.lastRecordTimestamp).toBeDefined();
    });

    it('should throw error for empty transcript', () => {
      expect(() => recorder.getTranscriptIntegrityProof()).toThrow('No records available for integrity proof');
    });
  });

  describe('record properties', () => {
    beforeEach(() => {
      recorder.startRecording();
    });

    it('should store complete record information', () => {
      const testData = Buffer.from('complete test data');
      const beforeTime = Date.now();
      
      recorder.recordTLSRecord(23, 0x0303, testData);
      
      const records = recorder.getRecords();
      const record = records[0];
      
      expect(record.type).toBe(23);
      expect(record.version).toBe(0x0303);
      expect(record.length).toBe(testData.length);
      expect(record.data).toEqual(testData);
      expect(record.timestamp).toBeGreaterThanOrEqual(beforeTime);
      expect(record.sequenceNumber).toBe(0);
    });

    it('should create independent data copies', () => {
      const originalData = Buffer.from('original data');
      recorder.recordTLSRecord(23, 0x0303, originalData);
      
      // Modify original buffer
      originalData.fill(0);
      
      const records = recorder.getRecords();
      expect(records[0].data.toString()).toBe('original data');
    });
  });

  describe('state management', () => {
    it('should reset records when starting new recording', () => {
      recorder.startRecording();
      recorder.recordTLSRecord(23, 0x0303, Buffer.from('first session'));
      
      expect(recorder.getRecords()).toHaveLength(1);
      
      recorder.startRecording(); // Start new recording
      expect(recorder.getRecords()).toHaveLength(0);
      
      recorder.recordTLSRecord(23, 0x0303, Buffer.from('second session'));
      expect(recorder.getRecords()).toHaveLength(1);
    });
  });
});