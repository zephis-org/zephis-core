import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock node-forge
vi.mock('node-forge', () => ({
  default: {
    pki: {
      certificateFromPem: vi.fn(),
      certificateToAsn1: vi.fn()
    },
    asn1: {
      toDer: vi.fn()
    },
    md: {
      sha256: {
        create: vi.fn(() => ({
          update: vi.fn(),
          digest: vi.fn(() => ({
            toHex: vi.fn().mockReturnValue('abcd1234')
          }))
        }))
      }
    }
  }
}));

vi.mock('../../src/utils/logger', () => ({
  default: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn()
  }
}));

import { CertificateValidator } from '../../src/tls/certificate-validator';

describe('CertificateValidator', () => {
  let certificateValidator: CertificateValidator;
  let mockForge: any;

  beforeEach(async () => {
    vi.clearAllMocks();
    
    mockForge = (await import('node-forge')).default;
    certificateValidator = new CertificateValidator();
  });

  describe('constructor', () => {
    it('should initialize with trusted roots', () => {
      expect(certificateValidator).toBeDefined();
    });
  });

  describe('validateCertificate', () => {
    it('should validate a valid certificate', async () => {
      const mockCert = {
        validity: {
          notBefore: new Date(Date.now() - 86400000), // 1 day ago
          notAfter: new Date(Date.now() + 86400000)    // 1 day from now
        },
        issuer: {
          getField: vi.fn().mockReturnValue({ value: 'Test CA' })
        },
        subject: {
          getField: vi.fn().mockReturnValue({ value: 'example.com' })
        }
      };

      mockForge.pki.certificateFromPem.mockReturnValue(mockCert);

      const result = await certificateValidator.validateCertificate('-----BEGIN CERTIFICATE-----test-----END CERTIFICATE-----');

      expect(result.valid).toBe(true);
      expect(result.issuer).toBe('Test CA');
      expect(result.subject).toBe('example.com');
    });

    it('should detect expired certificate', async () => {
      const mockCert = {
        validity: {
          notBefore: new Date(Date.now() - 172800000), // 2 days ago
          notAfter: new Date(Date.now() - 86400000)     // 1 day ago (expired)
        },
        issuer: {
          getField: vi.fn().mockReturnValue({ value: 'Test CA' })
        },
        subject: {
          getField: vi.fn().mockReturnValue({ value: 'example.com' })
        }
      };

      mockForge.pki.certificateFromPem.mockReturnValue(mockCert);

      const result = await certificateValidator.validateCertificate('-----BEGIN CERTIFICATE-----test-----END CERTIFICATE-----');

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Certificate expired');
    });

    it('should detect not yet valid certificate', async () => {
      const mockCert = {
        validity: {
          notBefore: new Date(Date.now() + 86400000),  // 1 day from now (not yet valid)
          notAfter: new Date(Date.now() + 172800000)    // 2 days from now
        },
        issuer: {
          getField: vi.fn().mockReturnValue({ value: 'Test CA' })
        },
        subject: {
          getField: vi.fn().mockReturnValue({ value: 'example.com' })
        }
      };

      mockForge.pki.certificateFromPem.mockReturnValue(mockCert);

      const result = await certificateValidator.validateCertificate('-----BEGIN CERTIFICATE-----test-----END CERTIFICATE-----');

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Certificate not yet valid');
    });

    it('should handle certificate parsing errors', async () => {
      mockForge.pki.certificateFromPem.mockImplementation(() => {
        throw new Error('Invalid PEM format');
      });

      const result = await certificateValidator.validateCertificate('invalid-certificate');

      expect(result.valid).toBe(false);
      expect(result.issuer).toBe('Unknown');
      expect(result.subject).toBe('Unknown');
      expect(result.errors).toContain('Invalid certificate format');
    });

    it('should handle missing CN fields', async () => {
      const mockCert = {
        validity: {
          notBefore: new Date(Date.now() - 86400000),
          notAfter: new Date(Date.now() + 86400000)
        },
        issuer: {
          getField: vi.fn().mockReturnValue(null)
        },
        subject: {
          getField: vi.fn().mockReturnValue(null)
        }
      };

      mockForge.pki.certificateFromPem.mockReturnValue(mockCert);

      const result = await certificateValidator.validateCertificate('-----BEGIN CERTIFICATE-----test-----END CERTIFICATE-----');

      expect(result.issuer).toBe('Unknown');
      expect(result.subject).toBe('Unknown');
    });
  });

  describe('validateCertificateChain', () => {
    it('should validate a single certificate chain', async () => {
      const mockCert = {
        verify: vi.fn()
      };

      mockForge.pki.certificateFromPem.mockReturnValue(mockCert);

      const result = await certificateValidator.validateCertificateChain([
        '-----BEGIN CERTIFICATE-----cert1-----END CERTIFICATE-----'
      ]);

      expect(result.valid).toBe(true);
      expect(result.chainLength).toBe(1);
    });

    it('should validate a multi-certificate chain', async () => {
      const mockCert1 = {
        verify: vi.fn()
      };
      const mockCert2 = {
        verify: vi.fn()
      };

      mockForge.pki.certificateFromPem
        .mockReturnValueOnce(mockCert1)
        .mockReturnValueOnce(mockCert2);

      const result = await certificateValidator.validateCertificateChain([
        '-----BEGIN CERTIFICATE-----cert1-----END CERTIFICATE-----',
        '-----BEGIN CERTIFICATE-----cert2-----END CERTIFICATE-----'
      ]);

      expect(result.valid).toBe(true);
      expect(result.chainLength).toBe(2);
    });

    it('should handle empty certificate chain', async () => {
      const result = await certificateValidator.validateCertificateChain([]);

      expect(result.valid).toBe(false);
      expect(result.chainLength).toBe(0);
      expect(result.errors).toContain('No certificates provided');
    });

    it('should detect invalid certificates in chain', async () => {
      mockForge.pki.certificateFromPem.mockImplementation(() => {
        throw new Error('Invalid certificate');
      });

      const result = await certificateValidator.validateCertificateChain([
        'invalid-cert'
      ]);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Invalid certificate at position 0');
    });

    it('should detect verification failures in chain', async () => {
      const mockCert1 = {
        verify: vi.fn().mockImplementation(() => {
          throw new Error('Verification failed');
        })
      };
      const mockCert2 = {
        verify: vi.fn()
      };

      mockForge.pki.certificateFromPem
        .mockReturnValueOnce(mockCert1)
        .mockReturnValueOnce(mockCert2);

      const result = await certificateValidator.validateCertificateChain([
        '-----BEGIN CERTIFICATE-----cert1-----END CERTIFICATE-----',
        '-----BEGIN CERTIFICATE-----cert2-----END CERTIFICATE-----'
      ]);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Certificate 1 does not verify certificate 0');
    });
  });

  describe('extractDomainFromCertificate', () => {
    it('should extract domain from CN field', () => {
      const mockCert = {
        subject: {
          getField: vi.fn().mockReturnValue({ value: 'example.com' })
        },
        getExtension: vi.fn().mockReturnValue(null)
      };

      mockForge.pki.certificateFromPem.mockReturnValue(mockCert);

      const domain = certificateValidator.extractDomainFromCertificate('-----BEGIN CERTIFICATE-----test-----END CERTIFICATE-----');

      expect(domain).toBe('example.com');
    });

    it('should handle wildcard certificates', () => {
      const mockCert = {
        subject: {
          getField: vi.fn().mockReturnValue({ value: '*.example.com' })
        },
        getExtension: vi.fn().mockReturnValue(null)
      };

      mockForge.pki.certificateFromPem.mockReturnValue(mockCert);

      const domain = certificateValidator.extractDomainFromCertificate('-----BEGIN CERTIFICATE-----test-----END CERTIFICATE-----');

      expect(domain).toBe('example.com');
    });

    it('should extract domain from SAN extension', () => {
      const mockCert = {
        subject: {
          getField: vi.fn().mockReturnValue(null)
        },
        getExtension: vi.fn().mockReturnValue({
          altNames: [
            { type: 2, value: 'example.com' }
          ]
        })
      };

      mockForge.pki.certificateFromPem.mockReturnValue(mockCert);

      const domain = certificateValidator.extractDomainFromCertificate('-----BEGIN CERTIFICATE-----test-----END CERTIFICATE-----');

      expect(domain).toBe('example.com');
    });

    it('should handle certificate parsing errors', () => {
      mockForge.pki.certificateFromPem.mockImplementation(() => {
        throw new Error('Invalid certificate');
      });

      const domain = certificateValidator.extractDomainFromCertificate('invalid-cert');

      expect(domain).toBeNull();
    });
  });

  describe('generateCertificateFingerprint', () => {
    it('should generate certificate fingerprint', () => {
      const mockCert = {};
      const mockDer = { getBytes: vi.fn().mockReturnValue('der-bytes') };

      mockForge.pki.certificateFromPem.mockReturnValue(mockCert);
      mockForge.pki.certificateToAsn1.mockReturnValue({});
      mockForge.asn1.toDer.mockReturnValue(mockDer);

      const fingerprint = certificateValidator.generateCertificateFingerprint('-----BEGIN CERTIFICATE-----test-----END CERTIFICATE-----');

      expect(fingerprint).toBe('abcd1234');
    });

    it('should handle certificate parsing errors', () => {
      mockForge.pki.certificateFromPem.mockImplementation(() => {
        throw new Error('Invalid certificate');
      });

      const fingerprint = certificateValidator.generateCertificateFingerprint('invalid-cert');

      expect(fingerprint).toBeNull();
    });
  });

  describe('isSelfSigned', () => {
    it('should detect self-signed certificate', () => {
      const mockCert = {
        issuer: {
          getField: vi.fn().mockReturnValue({ value: 'Self-Signed CA' })
        },
        subject: {
          getField: vi.fn().mockReturnValue({ value: 'Self-Signed CA' })
        }
      };

      mockForge.pki.certificateFromPem.mockReturnValue(mockCert);

      const isSelfSigned = certificateValidator.isSelfSigned('-----BEGIN CERTIFICATE-----test-----END CERTIFICATE-----');

      expect(isSelfSigned).toBe(true);
    });

    it('should detect non-self-signed certificate', () => {
      const mockCert = {
        issuer: {
          getField: vi.fn().mockReturnValue({ value: 'Different CA' })
        },
        subject: {
          getField: vi.fn().mockReturnValue({ value: 'example.com' })
        }
      };

      mockForge.pki.certificateFromPem.mockReturnValue(mockCert);

      const isSelfSigned = certificateValidator.isSelfSigned('-----BEGIN CERTIFICATE-----test-----END CERTIFICATE-----');

      expect(isSelfSigned).toBe(false);
    });

    it('should handle missing CN fields', () => {
      const mockCert = {
        issuer: {
          getField: vi.fn().mockReturnValue(null)
        },
        subject: {
          getField: vi.fn().mockReturnValue(null)
        }
      };

      mockForge.pki.certificateFromPem.mockReturnValue(mockCert);

      const isSelfSigned = certificateValidator.isSelfSigned('-----BEGIN CERTIFICATE-----test-----END CERTIFICATE-----');

      expect(isSelfSigned).toBe(false);
    });

    it('should handle certificate parsing errors', () => {
      mockForge.pki.certificateFromPem.mockImplementation(() => {
        throw new Error('Invalid certificate');
      });

      const isSelfSigned = certificateValidator.isSelfSigned('invalid-cert');

      expect(isSelfSigned).toBe(false);
    });
  });
});