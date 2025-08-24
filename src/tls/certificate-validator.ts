import forge from "node-forge";
import logger from "../utils/logger";

export class CertificateValidator {
  private trustedRoots: Set<string> = new Set();

  constructor() {
    this.loadTrustedRoots();
  }

  private loadTrustedRoots(): void {
    const commonRoots = [
      "DigiCert Global Root CA",
      "VeriSign Class 3 Public Primary Certification Authority - G5",
      "GlobalSign Root CA",
      "AddTrust External CA Root",
      "Baltimore CyberTrust Root",
      "Entrust Root Certification Authority",
      "GeoTrust Global CA",
      "Go Daddy Root Certificate Authority - G2",
      "Starfield Root Certificate Authority - G2",
      "USERTrust RSA Certification Authority",
      "Amazon Root CA 1",
      "Let's Encrypt Authority X3",
    ];

    commonRoots.forEach((root) => this.trustedRoots.add(root));
  }

  async validateCertificate(certificatePem: string): Promise<{
    valid: boolean;
    issuer: string;
    subject: string;
    validFrom: Date;
    validTo: Date;
    errors?: string[];
  }> {
    try {
      const cert = forge.pki.certificateFromPem(certificatePem);
      const now = new Date();
      const errors: string[] = [];

      if (now < cert.validity.notBefore) {
        errors.push("Certificate not yet valid");
      }

      if (now > cert.validity.notAfter) {
        errors.push("Certificate expired");
      }

      const issuerCN = cert.issuer.getField("CN");
      const subjectCN = cert.subject.getField("CN");

      const result = {
        valid: errors.length === 0,
        issuer: issuerCN ? issuerCN.value.toString() : "Unknown",
        subject: subjectCN ? subjectCN.value.toString() : "Unknown",
        validFrom: cert.validity.notBefore,
        validTo: cert.validity.notAfter,
        errors: errors.length > 0 ? errors : undefined,
      };

      logger.debug("Certificate validation result:", result);
      return result;
    } catch (_error) {
      logger.error("Certificate validation error:", _error);
      return {
        valid: false,
        issuer: "Unknown",
        subject: "Unknown",
        validFrom: new Date(),
        validTo: new Date(),
        errors: ["Invalid certificate format"],
      };
    }
  }

  async validateCertificateChain(certificates: string[]): Promise<{
    valid: boolean;
    chainLength: number;
    errors?: string[];
  }> {
    if (certificates.length === 0) {
      return {
        valid: false,
        chainLength: 0,
        errors: ["No certificates provided"],
      };
    }

    const errors: string[] = [];
    let previousCert: forge.pki.Certificate | null = null;

    for (let i = 0; i < certificates.length; i++) {
      try {
        const cert = forge.pki.certificateFromPem(certificates[i]);

        if (previousCert) {
          try {
            previousCert.verify(cert);
          } catch (_verifyError) {
            errors.push(
              `Certificate ${i} does not verify certificate ${i - 1}`,
            );
          }
        }

        previousCert = cert;
      } catch (_error) {
        errors.push(`Invalid certificate at position ${i}`);
      }
    }

    return {
      valid: errors.length === 0,
      chainLength: certificates.length,
      errors: errors.length > 0 ? errors : undefined,
    };
  }

  extractDomainFromCertificate(certificatePem: string): string | null {
    try {
      const cert = forge.pki.certificateFromPem(certificatePem);
      const subjectCN = cert.subject.getField("CN");

      if (subjectCN) {
        const cn = subjectCN.value.toString();
        return cn.replace("*.", "");
      }

      const altNames = cert.getExtension("subjectAltName");
      if (altNames && (altNames as any).altNames) {
        const dnsNames = (altNames as any).altNames.filter(
          (name: any) => name.type === 2,
        );
        if (dnsNames.length > 0) {
          return dnsNames[0].value.replace("*.", "");
        }
      }

      return null;
    } catch (_error) {
      logger.error("Error extracting domain from certificate:", _error);
      return null;
    }
  }

  generateCertificateFingerprint(certificatePem: string): string | null {
    try {
      const cert = forge.pki.certificateFromPem(certificatePem);
      const der = forge.asn1.toDer(forge.pki.certificateToAsn1(cert));
      const md = forge.md.sha256.create();
      md.update(der.getBytes());
      return md.digest().toHex();
    } catch (_error) {
      logger.error("Error generating certificate fingerprint:", _error);
      return null;
    }
  }

  isSelfSigned(certificatePem: string): boolean {
    try {
      const cert = forge.pki.certificateFromPem(certificatePem);
      const issuerCN = cert.issuer.getField("CN");
      const subjectCN = cert.subject.getField("CN");

      if (!issuerCN || !subjectCN) {
        return false;
      }

      return issuerCN.value === subjectCN.value;
    } catch (_error) {
      logger.error("Error checking if certificate is self-signed:", _error);
      return false;
    }
  }
}
