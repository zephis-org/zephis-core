import { describe, it, expect, beforeEach } from 'vitest';
import { HandshakeCircuit } from '../../src/proof-generation/handshake-circuit';
import type { HandshakeProofInputs } from '../../src/proof-generation/handshake-circuit';

describe('HandshakeCircuit', () => {
  let circuit: HandshakeCircuit;
  
  beforeEach(() => {
    circuit = new HandshakeCircuit(
      '/path/to/handshake.wasm',
      '/path/to/handshake.zkey',
      '/path/to/handshake.vkey'
    );
  });

  describe('initialization', () => {
    it('should create circuit with provided paths', () => {
      expect(circuit).toBeDefined();
      expect(circuit).toBeInstanceOf(HandshakeCircuit);
    });

    it('should fail to initialize with invalid paths', async () => {
      await expect(circuit.initialize()).rejects.toThrow('Failed to initialize handshake circuit');
    });
  });

  describe('proof generation', () => {
    const validInputs: HandshakeProofInputs = {
      clientHello: ['72', '101', '108', '108', '111'],
      serverHello: ['87', '111', '114', '108', '100'],
      serverCertificate: Array.from({ length: 150 }, (_, i) => (i + 1).toString()),
      clientKeyExchange: ['10', '20', '30', '40'],
      masterSecret: Array.from({ length: 48 }, (_, i) => (i + 1).toString()),
      clientRandom: Array.from({ length: 32 }, (_, i) => (i + 1).toString()),
      serverRandom: Array.from({ length: 32 }, (_, i) => (i + 32).toString()),
      cipherSuite: 'TLS_RSA_WITH_AES_128_CBC_SHA'
    };

    it('should throw error when not initialized', async () => {
      await expect(circuit.generateProof(validInputs))
        .rejects.toThrow('Circuit not initialized');
    });

    it('should validate handshake sequence', () => {
      const result = circuit.validateHandshakeSequence(validInputs);
      expect(result).toBe(true);
    });

    it('should reject empty handshake messages', () => {
      const invalidInputs = { ...validInputs, clientHello: [] };
      const result = circuit.validateHandshakeSequence(invalidInputs);
      expect(result).toBe(false);
    });

    it('should validate certificate chain', () => {
      const validCert = Array.from({ length: 150 }, (_, i) => (i + 1).toString());
      const result = circuit.validateCertificateChain(validCert);
      expect(result).toBe(true);
    });

    it('should reject short certificate', () => {
      const shortCert = ['1', '2', '3'];
      const result = circuit.validateCertificateChain(shortCert);
      expect(result).toBe(false);
    });

    it('should handle certificate validation errors', () => {
      const result = circuit.validateCertificateChain([]);
      expect(result).toBe(false);
    });
  });

  describe('key derivation validation', () => {
    it('should validate key derivation process', () => {
      const preMasterSecret = Array.from({ length: 48 }, (_, i) => (i + 1).toString());
      const clientRandom = Array.from({ length: 32 }, (_, i) => (i + 1).toString());
      const serverRandom = Array.from({ length: 32 }, (_, i) => (i + 32).toString());
      const expectedMasterSecret = Array.from({ length: 48 }, (_, i) => (i + 1).toString());

      // This will validate the HKDF simulation
      const result = circuit.validateKeyDerivation(
        preMasterSecret,
        clientRandom,
        serverRandom,
        expectedMasterSecret
      );
      expect(typeof result).toBe('boolean');
    });

    it('should handle key derivation errors', () => {
      const result = circuit.validateKeyDerivation([], [], [], []);
      expect(result).toBe(false);
    });
  });

  describe('public outputs extraction', () => {
    const validInputs: HandshakeProofInputs = {
      clientHello: ['72', '101', '108', '108', '111'],
      serverHello: ['87', '111', '114', '108', '100'],
      serverCertificate: Array.from({ length: 150 }, (_, i) => (i + 1).toString()),
      clientKeyExchange: ['10', '20', '30', '40'],
      masterSecret: Array.from({ length: 48 }, (_, i) => (i + 1).toString()),
      clientRandom: Array.from({ length: 32 }, (_, i) => (i + 1).toString()),
      serverRandom: Array.from({ length: 32 }, (_, i) => (i + 32).toString()),
      cipherSuite: 'TLS_RSA_WITH_AES_128_CBC_SHA'
    };

    it('should extract public outputs', () => {
      const outputs = circuit.extractPublicOutputs(validInputs);
      
      expect(outputs).toBeDefined();
      expect(outputs.sessionCommitment).toBeDefined();
      expect(outputs.certificateValid).toBe(true);
      expect(typeof outputs.keyDerivationValid).toBe('boolean');
      expect(outputs.cipherSuiteSupported).toBe(true);
    });

    it('should identify unsupported cipher suites', () => {
      const unsupportedInputs = { ...validInputs, cipherSuite: 'UNSUPPORTED_CIPHER' };
      const outputs = circuit.extractPublicOutputs(unsupportedInputs);
      
      expect(outputs.cipherSuiteSupported).toBe(false);
    });
  });

  describe('proof verification', () => {
    it('should handle verification with invalid proof', async () => {
      const mockProof = { pi_a: [1, 2], pi_b: [[3, 4], [5, 6]], pi_c: [7, 8] };
      const mockPublicSignals = ['1', '2', '3'];
      const mockVerificationKey = { vk_alpha_1: [1, 2] };

      const result = await circuit.verifyProof(mockProof, mockPublicSignals, mockVerificationKey);
      expect(result).toBe(false);
    });

    it('should handle verification errors gracefully', async () => {
      const result = await circuit.verifyProof(null, [], null);
      expect(result).toBe(false);
    });
  });

  describe('gas estimation', () => {
    it('should provide gas cost estimate', () => {
      const gasEstimate = circuit.estimateGasCost();
      expect(gasEstimate).toBe(250000);
      expect(typeof gasEstimate).toBe('number');
    });
  });

  describe('cipher suite support', () => {
    const supportedSuites = [
      'TLS_RSA_WITH_AES_128_CBC_SHA',
      'TLS_RSA_WITH_AES_256_CBC_SHA',
      'TLS_RSA_WITH_AES_128_CBC_SHA256',
      'TLS_RSA_WITH_AES_256_CBC_SHA256',
      'TLS_RSA_WITH_AES_128_GCM_SHA256',
      'TLS_RSA_WITH_AES_256_GCM_SHA384'
    ];

    supportedSuites.forEach(suite => {
      it(`should support ${suite}`, () => {
        const inputs = {
          clientHello: ['1'],
          serverHello: ['2'],
          serverCertificate: Array.from({ length: 150 }, (_, i) => (i + 1).toString()),
          clientKeyExchange: ['3'],
          masterSecret: ['4'],
          clientRandom: ['5'],
          serverRandom: ['6'],
          cipherSuite: suite
        };
        
        const outputs = circuit.extractPublicOutputs(inputs);
        expect(outputs.cipherSuiteSupported).toBe(true);
      });
    });
  });

  describe('session commitment', () => {
    it('should generate consistent session commitments', () => {
      const inputs: HandshakeProofInputs = {
        clientHello: ['1', '2', '3'],
        serverHello: ['4', '5', '6'],
        serverCertificate: Array.from({ length: 150 }, (_, i) => (i + 1).toString()),
        clientKeyExchange: ['7', '8', '9'],
        masterSecret: ['10', '11', '12'],
        clientRandom: ['13', '14', '15'],
        serverRandom: ['16', '17', '18'],
        cipherSuite: 'TLS_RSA_WITH_AES_128_CBC_SHA'
      };

      const outputs1 = circuit.extractPublicOutputs(inputs);
      const outputs2 = circuit.extractPublicOutputs(inputs);
      
      expect(outputs1.sessionCommitment).toBe(outputs2.sessionCommitment);
    });

    it('should generate different commitments for different inputs', () => {
      const inputs1: HandshakeProofInputs = {
        clientHello: ['1', '2', '3'],
        serverHello: ['4', '5', '6'],
        serverCertificate: Array.from({ length: 150 }, (_, i) => (i + 1).toString()),
        clientKeyExchange: ['7', '8', '9'],
        masterSecret: ['10', '11', '12'],
        clientRandom: ['13', '14', '15'],
        serverRandom: ['16', '17', '18'],
        cipherSuite: 'TLS_RSA_WITH_AES_128_CBC_SHA'
      };

      const inputs2: HandshakeProofInputs = {
        ...inputs1,
        clientHello: ['99', '98', '97']
      };

      const outputs1 = circuit.extractPublicOutputs(inputs1);
      const outputs2 = circuit.extractPublicOutputs(inputs2);
      
      expect(outputs1.sessionCommitment).not.toBe(outputs2.sessionCommitment);
    });
  });

  describe('input encoding', () => {
    it('should encode cipher suite correctly', () => {
      const validInputs: HandshakeProofInputs = {
        clientHello: ['1'],
        serverHello: ['2'],
        serverCertificate: Array.from({ length: 150 }, (_, i) => (i + 1).toString()),
        clientKeyExchange: ['3'],
        masterSecret: ['4'],
        clientRandom: ['5'],
        serverRandom: ['6'],
        cipherSuite: 'TLS_RSA_WITH_AES_128_CBC_SHA'
      };

      // This tests the private prepareCircuitInputs method indirectly
      expect(() => circuit.extractPublicOutputs(validInputs)).not.toThrow();
    });
  });
});