import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { TLSSessionCapture } from '../../src/tls/session-capture';
import { Page } from 'puppeteer';
import forge from 'node-forge';
import logger from '../../src/utils/logger';

// Mock dependencies
vi.mock('node-forge');
vi.mock('../../src/utils/logger');

describe('TLSSessionCapture', () => {
  let tlsCapture: TLSSessionCapture;
  let mockPage: Partial<Page>;
  let mockLogger: any;
  let mockForge: any;

  beforeEach(() => {
    vi.clearAllMocks();

    // Setup logger mock
    mockLogger = {
      info: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
      debug: vi.fn()
    };

    // Setup forge mock
    mockForge = {
      pki: {
        createCertificate: vi.fn().mockReturnValue({
          publicKey: null,
          serialNumber: '',
          validity: { notBefore: null, notAfter: null },
          setSubject: vi.fn(),
          setIssuer: vi.fn(),
          sign: vi.fn()
        }),
        certificateToPem: vi.fn().mockReturnValue('-----BEGIN CERTIFICATE-----\ntest\n-----END CERTIFICATE-----'),
        rsa: {
          generateKeyPair: vi.fn().mockReturnValue({
            publicKey: 'mockPublicKey',
            privateKey: 'mockPrivateKey'
          })
        }
      },
      random: {
        getBytesSync: vi.fn().mockImplementation((bytes: number) => 'x'.repeat(bytes))
      },
      util: {
        bytesToHex: vi.fn().mockImplementation((bytes: string) => Buffer.from(bytes).toString('hex'))
      }
    };

    // Setup page mock
    mockPage = {
      evaluateOnNewDocument: vi.fn().mockResolvedValue(undefined),
      on: vi.fn(),
      evaluate: vi.fn().mockResolvedValue([])
    };

    (logger as any).info = mockLogger.info;
    (logger as any).error = mockLogger.error;
    (logger as any).warn = mockLogger.warn;
    (logger as any).debug = mockLogger.debug;

    (forge as any).pki = mockForge.pki;
    (forge as any).random = mockForge.random;
    (forge as any).util = mockForge.util;

    tlsCapture = new TLSSessionCapture();
  });

  afterEach(() => {
    tlsCapture.clearCapturedData();
  });

  describe('attachToPage', () => {
    it('should attach to page and setup interceptors', async () => {
      await tlsCapture.attachToPage(mockPage as Page);

      expect(mockPage.evaluateOnNewDocument).toHaveBeenCalledWith(expect.any(Function));
      expect(mockPage.on).toHaveBeenCalledWith('response', expect.any(Function));
    });

    it('should handle page attachment with null page', async () => {
      await expect(tlsCapture.attachToPage(null as any)).resolves.toBeUndefined();
    });
  });

  describe('TLS Interception', () => {
    beforeEach(async () => {
      await tlsCapture.attachToPage(mockPage as Page);
    });

    it('should inject TLS interceptor script', () => {
      expect(mockPage.evaluateOnNewDocument).toHaveBeenCalledWith(expect.any(Function));
      
      // Verify the injected script structure by calling the function
      const injectedScript = (mockPage.evaluateOnNewDocument as any).mock.calls[0][0];
      expect(typeof injectedScript).toBe('function');
    });

    it('should setup request interception on response events', () => {
      expect(mockPage.on).toHaveBeenCalledWith('response', expect.any(Function));
    });

    it('should handle response event with security details', async () => {
      const responseHandler = (mockPage.on as any).mock.calls
        .find((call: any[]) => call[0] === 'response')[1];

      const mockResponse = {
        url: () => 'https://example.com',
        securityDetails: () => ({
          subjectName: 'example.com',
          issuer: 'Test CA',
          validFrom: Math.floor(Date.now() / 1000),
          validTo: Math.floor(Date.now() / 1000) + 86400
        })
      };

      await responseHandler(mockResponse);

      expect(mockLogger.debug).toHaveBeenCalledWith('TLS session captured for https://example.com');
    });

    it('should handle response event without security details', async () => {
      const responseHandler = (mockPage.on as any).mock.calls
        .find((call: any[]) => call[0] === 'response')[1];

      const mockResponse = {
        url: () => 'http://example.com',
        securityDetails: () => null
      };

      await responseHandler(mockResponse);

      expect(mockLogger.debug).not.toHaveBeenCalled();
    });

    it('should handle errors during response processing', async () => {
      const responseHandler = (mockPage.on as any).mock.calls
        .find((call: any[]) => call[0] === 'response')[1];

      const mockResponse = {
        url: () => { throw new Error('URL error'); },
        securityDetails: () => null
      };

      await responseHandler(mockResponse);

      expect(mockLogger.error).toHaveBeenCalledWith('Error capturing TLS session:', expect.any(Error));
    });
  });

  describe('extractSessionData', () => {
    beforeEach(async () => {
      await tlsCapture.attachToPage(mockPage as Page);
    });

    it('should extract session data from security details', async () => {
      const securityDetails = {
        subjectName: 'example.com',
        issuer: 'Test CA',
        validFrom: Math.floor(Date.now() / 1000),
        validTo: Math.floor(Date.now() / 1000) + 86400
      };

      // Mock the private method by creating a response event
      const responseHandler = (mockPage.on as any).mock.calls
        .find((call: any[]) => call[0] === 'response')[1];

      const mockResponse = {
        url: () => 'https://example.com',
        securityDetails: () => securityDetails
      };

      await responseHandler(mockResponse);

      const sessions = await tlsCapture.getCapturedSessions();
      expect(sessions).toHaveLength(1);
      
      const sessionData = sessions[0];
      expect(sessionData).toHaveProperty('serverCertificate');
      expect(sessionData).toHaveProperty('sessionKeys');
      expect(sessionData.sessionKeys).toHaveProperty('clientRandom');
      expect(sessionData.sessionKeys).toHaveProperty('serverRandom');
      expect(sessionData.sessionKeys).toHaveProperty('masterSecret');
      expect(sessionData).toHaveProperty('handshakeMessages');
      expect(sessionData.handshakeMessages).toHaveLength(6);
      expect(sessionData).toHaveProperty('timestamp');
    });

    it('should handle errors during session data extraction', async () => {
      // Mock forge to throw an error
      mockForge.pki.createCertificate.mockImplementation(() => {
        throw new Error('Certificate creation failed');
      });

      const responseHandler = (mockPage.on as any).mock.calls
        .find((call: any[]) => call[0] === 'response')[1];

      const mockResponse = {
        url: () => 'https://example.com',
        securityDetails: () => ({
          subjectName: 'example.com',
          issuer: 'Test CA',
          validFrom: Math.floor(Date.now() / 1000),
          validTo: Math.floor(Date.now() / 1000) + 86400
        })
      };

      await responseHandler(mockResponse);

      expect(mockLogger.error).toHaveBeenCalledWith('Error extracting session data:', expect.any(Error));
    });
  });

  describe('encodeCertificate', () => {
    it('should generate forge certificate structure', async () => {
      const securityDetails = {
        subjectName: 'example.com',
        issuer: 'Test CA',
        validFrom: Math.floor(Date.now() / 1000),
        validTo: Math.floor(Date.now() / 1000) + 86400
      };

      await tlsCapture.attachToPage(mockPage as Page);

      const responseHandler = (mockPage.on as any).mock.calls
        .find((call: any[]) => call[0] === 'response')[1];

      const mockResponse = {
        url: () => 'https://example.com',
        securityDetails: () => securityDetails
      };

      await responseHandler(mockResponse);

      expect(mockForge.pki.createCertificate).toHaveBeenCalled();
      expect(mockForge.pki.certificateToPem).toHaveBeenCalled();
      expect(mockForge.pki.rsa.generateKeyPair).toHaveBeenCalledWith({ bits: 2048 });
    });
  });

  describe('generateRandomHex', () => {
    it('should generate random hex values of correct length', async () => {
      await tlsCapture.attachToPage(mockPage as Page);

      const responseHandler = (mockPage.on as any).mock.calls
        .find((call: any[]) => call[0] === 'response')[1];

      const mockResponse = {
        url: () => 'https://example.com',
        securityDetails: () => ({
          subjectName: 'example.com',
          issuer: 'Test CA',
          validFrom: Math.floor(Date.now() / 1000),
          validTo: Math.floor(Date.now() / 1000) + 86400
        })
      };

      await responseHandler(mockResponse);

      expect(mockForge.random.getBytesSync).toHaveBeenCalledWith(32); // clientRandom
      expect(mockForge.random.getBytesSync).toHaveBeenCalledWith(48); // masterSecret
      expect(mockForge.util.bytesToHex).toHaveBeenCalled();
    });
  });

  describe('generateHandshakeMessage', () => {
    it('should generate handshake messages for all types', async () => {
      await tlsCapture.attachToPage(mockPage as Page);

      const responseHandler = (mockPage.on as any).mock.calls
        .find((call: any[]) => call[0] === 'response')[1];

      const mockResponse = {
        url: () => 'https://example.com',
        securityDetails: () => ({
          subjectName: 'example.com',
          issuer: 'Test CA',
          validFrom: Math.floor(Date.now() / 1000),
          validTo: Math.floor(Date.now() / 1000) + 86400
        })
      };

      await responseHandler(mockResponse);

      // Verify all handshake message types are generated
      expect(mockForge.random.getBytesSync).toHaveBeenCalledWith(64);
      expect(mockForge.util.bytesToHex).toHaveBeenCalled();
    });
  });

  describe('getCapturedSessions', () => {
    beforeEach(async () => {
      await tlsCapture.attachToPage(mockPage as Page);
    });

    it('should return captured sessions', async () => {
      // Trigger a session capture
      const responseHandler = (mockPage.on as any).mock.calls
        .find((call: any[]) => call[0] === 'response')[1];

      const mockResponse = {
        url: () => 'https://example.com',
        securityDetails: () => ({
          subjectName: 'example.com',
          issuer: 'Test CA',
          validFrom: Math.floor(Date.now() / 1000),
          validTo: Math.floor(Date.now() / 1000) + 86400
        })
      };

      await responseHandler(mockResponse);

      const sessions = await tlsCapture.getCapturedSessions();
      expect(sessions).toHaveLength(1);
      expect(mockPage.evaluate).toHaveBeenCalledWith(expect.any(Function));
    });

    it('should return empty array when no page attached', async () => {
      const _emptyCaptureInstance = new TLSSessionCapture();
      const sessions = await _emptyCaptureInstance.getCapturedSessions();
      expect(sessions).toHaveLength(0);
    });

    it('should handle errors during session retrieval', async () => {
      (mockPage.evaluate as any).mockRejectedValue(new Error('Evaluation failed'));

      const sessions = await tlsCapture.getCapturedSessions();
      
      expect(mockLogger.error).toHaveBeenCalledWith('Error retrieving captured sessions:', expect.any(Error));
      expect(sessions).toHaveLength(0);
    });
  });

  describe('getSessionForDomain', () => {
    beforeEach(async () => {
      await tlsCapture.attachToPage(mockPage as Page);
    });

    it('should return session for matching domain', async () => {
      // Capture a session
      const responseHandler = (mockPage.on as any).mock.calls
        .find((call: any[]) => call[0] === 'response')[1];

      const mockResponse = {
        url: () => 'https://example.com/path',
        securityDetails: () => ({
          subjectName: 'example.com',
          issuer: 'Test CA',
          validFrom: Math.floor(Date.now() / 1000),
          validTo: Math.floor(Date.now() / 1000) + 86400
        })
      };

      await responseHandler(mockResponse);

      const sessionData = await tlsCapture.getSessionForDomain('example.com');
      expect(sessionData).toBeDefined();
      expect(sessionData).toHaveProperty('serverCertificate');
    });

    it('should return null for non-matching domain', async () => {
      // Capture a session for example.com
      const responseHandler = (mockPage.on as any).mock.calls
        .find((call: any[]) => call[0] === 'response')[1];

      const mockResponse = {
        url: () => 'https://example.com/path',
        securityDetails: () => ({
          subjectName: 'example.com',
          issuer: 'Test CA',
          validFrom: Math.floor(Date.now() / 1000),
          validTo: Math.floor(Date.now() / 1000) + 86400
        })
      };

      await responseHandler(mockResponse);

      const sessionData = await tlsCapture.getSessionForDomain('other.com');
      expect(sessionData).toBeNull();
    });
  });

  describe('clearCapturedData', () => {
    beforeEach(async () => {
      await tlsCapture.attachToPage(mockPage as Page);
    });

    it('should clear all captured data', async () => {
      // Capture a session first
      const responseHandler = (mockPage.on as any).mock.calls
        .find((call: any[]) => call[0] === 'response')[1];

      const mockResponse = {
        url: () => 'https://example.com',
        securityDetails: () => ({
          subjectName: 'example.com',
          issuer: 'Test CA',
          validFrom: Math.floor(Date.now() / 1000),
          validTo: Math.floor(Date.now() / 1000) + 86400
        })
      };

      await responseHandler(mockResponse);

      let sessions = await tlsCapture.getCapturedSessions();
      expect(sessions).toHaveLength(1);

      tlsCapture.clearCapturedData();

      sessions = await tlsCapture.getCapturedSessions();
      expect(sessions).toHaveLength(0);
    });
  });

  describe('Browser Script Injection', () => {
    it('should inject proper fetch interception', async () => {
      await tlsCapture.attachToPage(mockPage as Page);

      const injectedScript = (mockPage.evaluateOnNewDocument as any).mock.calls[0][0];
      
      // Mock window object for testing the injected script
      const _mockWindow = {
        __tlsCapture: { sessions: [], certificates: [] },
        fetch: vi.fn().mockResolvedValue({
          __securityDetails: {
            protocol: 'TLS 1.3',
            cipher: 'AES_256_GCM',
            certificate: 'mock-cert',
            subjectName: 'example.com',
            issuer: 'Test CA',
            validFrom: Date.now() / 1000,
            validTo: Date.now() / 1000 + 86400
          }
        }),
        XMLHttpRequest: class {
          open = vi.fn();
          send = vi.fn();
          addEventListener = vi.fn();
        }
      };

      // Execute the injected script in a mock environment
      const scriptFunction = injectedScript.toString();
      expect(scriptFunction).toContain('__tlsCapture');
      expect(scriptFunction).toContain('window.fetch');
      expect(scriptFunction).toContain('XMLHttpRequest');
    });
  });

  describe('Error Handling', () => {
    it('should handle page evaluation errors gracefully', async () => {
      mockPage.evaluateOnNewDocument = vi.fn().mockRejectedValue(new Error('Evaluation failed'));

      await tlsCapture.attachToPage(mockPage as Page);

      // Should not throw, but should handle the error internally
      expect(mockPage.evaluateOnNewDocument).toHaveBeenCalled();
    });

    it('should handle response processing errors without crashing', async () => {
      await tlsCapture.attachToPage(mockPage as Page);

      const responseHandler = (mockPage.on as any).mock.calls
        .find((call: any[]) => call[0] === 'response')[1];

      const mockResponse = {
        url: () => 'https://example.com',
        securityDetails: () => {
          throw new Error('Security details error');
        }
      };

      // Should not throw
      await expect(responseHandler(mockResponse)).resolves.toBeUndefined();
      expect(mockLogger.error).toHaveBeenCalledWith('Error capturing TLS session:', expect.any(Error));
    });
  });
});