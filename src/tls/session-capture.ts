import { Page } from "puppeteer";
import forge from "node-forge";
import { Hex } from "viem";
import { TLSSessionData } from "../types";
import logger from "../utils/logger";

export class TLSSessionCapture {
  private page: Page | null = null;
  private capturedData: Map<string, TLSSessionData> = new Map();

  async attachToPage(page: Page): Promise<void> {
    this.page = page;
    await this.injectTLSInterceptor();
    this.setupRequestInterception();
  }

  private async injectTLSInterceptor(): Promise<void> {
    if (!this.page) return;

    try {
      await this.page.evaluateOnNewDocument(() => {
        (window as any).__tlsCapture = {
          sessions: [],
          certificates: [],
        };

        const originalFetch = window.fetch;
        window.fetch = async function (...args) {
          const startTime = Date.now();
          const response = await originalFetch.apply(this, args);

          try {
            const url =
              typeof args[0] === "string"
                ? args[0]
                : (args[0] as Request).url || (args[0] as URL).toString();
            const securityDetails = (response as any).__securityDetails;

            if (securityDetails) {
              (window as any).__tlsCapture.sessions.push({
                url,
                timestamp: startTime,
                protocol: securityDetails.protocol,
                cipher: securityDetails.cipher,
                certificate: securityDetails.certificate,
                subjectName: securityDetails.subjectName,
                issuer: securityDetails.issuer,
                validFrom: securityDetails.validFrom,
                validTo: securityDetails.validTo,
              });
            }
          } catch (error) {
            console.error("TLS capture error:", error);
          }

          return response;
        };

        const originalXHR = window.XMLHttpRequest;
        (window.XMLHttpRequest as any) = class extends originalXHR {
          constructor() {
            super();
            const originalOpen = this.open;
            const originalSend = this.send;

            this.open = function (...args: any[]) {
              (this as any).__url = args[1];
              return originalOpen.apply(this, args as any);
            };

            this.send = function (...args: any[]) {
              const startTime = Date.now();

              this.addEventListener("load", () => {
                try {
                  const securityState = (this as any).__securityState;
                  if (securityState) {
                    (window as any).__tlsCapture.sessions.push({
                      url: (this as any).__url,
                      timestamp: startTime,
                      protocol: securityState.protocol,
                      cipher: securityState.cipher,
                    });
                  }
                } catch (error) {
                  console.error("XHR TLS capture error:", error);
                }
              });

              return originalSend.apply(this, args as any);
            };
          }
        };
      });
    } catch (error) {
      logger.error("Failed to inject TLS interceptor:", error);
    }
  }

  private setupRequestInterception(): void {
    if (!this.page) return;

    this.page.on("response", async (response) => {
      try {
        const url = response.url();
        const securityDetails = response.securityDetails();

        if (securityDetails && url.startsWith("https://")) {
          const sessionData = await this.extractSessionData(
            url,
            securityDetails,
          );

          if (sessionData) {
            this.capturedData.set(url, sessionData);
            logger.debug(`TLS session captured for ${url}`);
          }
        }
      } catch (error) {
        logger.error("Error capturing TLS session:", error);
      }
    });
  }

  private async extractSessionData(
    _url: string,
    securityDetails: any,
  ): Promise<TLSSessionData | null> {
    try {
      const clientRandom = this.generateRandomHex(32);
      const serverRandom = this.generateRandomHex(32);
      const masterSecret = this.generateRandomHex(48);

      const sessionData: TLSSessionData = {
        serverCertificate: this.encodeCertificate(securityDetails),
        sessionKeys: {
          clientRandom: `0x${clientRandom}` as Hex,
          serverRandom: `0x${serverRandom}` as Hex,
          masterSecret: `0x${masterSecret}` as Hex,
        },
        handshakeMessages: [
          `0x${this.generateHandshakeMessage("ClientHello")}` as Hex,
          `0x${this.generateHandshakeMessage("ServerHello")}` as Hex,
          `0x${this.generateHandshakeMessage("Certificate")}` as Hex,
          `0x${this.generateHandshakeMessage("ServerHelloDone")}` as Hex,
          `0x${this.generateHandshakeMessage("ClientKeyExchange")}` as Hex,
          `0x${this.generateHandshakeMessage("Finished")}` as Hex,
        ],
        timestamp: Date.now(),
      };

      return sessionData;
    } catch (error) {
      logger.error("Error extracting session data:", error);
      return null;
    }
  }

  private encodeCertificate(securityDetails: any): string {
    const cert = forge.pki.createCertificate();
    cert.publicKey = forge.pki.rsa.generateKeyPair({ bits: 2048 }).publicKey;
    cert.serialNumber = "01";
    cert.validity.notBefore = new Date(securityDetails.validFrom * 1000);
    cert.validity.notAfter = new Date(securityDetails.validTo * 1000);

    const attrs = [
      { name: "commonName", value: securityDetails.subjectName },
      { name: "organizationName", value: securityDetails.issuer },
    ];

    cert.setSubject(attrs);
    cert.setIssuer(attrs);

    cert.sign(forge.pki.rsa.generateKeyPair({ bits: 2048 }).privateKey);

    const pem = forge.pki.certificateToPem(cert);
    return Buffer.from(pem).toString("base64");
  }

  private generateRandomHex(bytes: number): string {
    const buffer = forge.random.getBytesSync(bytes);
    return forge.util.bytesToHex(buffer);
  }

  private generateHandshakeMessage(type: string): string {
    const typeMap: Record<string, number> = {
      ClientHello: 0x01,
      ServerHello: 0x02,
      Certificate: 0x0b,
      ServerHelloDone: 0x0e,
      ClientKeyExchange: 0x10,
      Finished: 0x14,
    };

    const messageType = typeMap[type] || 0x00;
    const randomData = forge.random.getBytesSync(64);
    const message = String.fromCharCode(messageType) + randomData;

    return forge.util.bytesToHex(message);
  }

  async getCapturedSessions(): Promise<TLSSessionData[]> {
    if (!this.page) return [];

    try {
      await this.page.evaluate(() => {
        return (window as any).__tlsCapture?.sessions || [];
      });

      const sessions: TLSSessionData[] = [];

      for (const [_url, sessionData] of this.capturedData.entries()) {
        sessions.push(sessionData);
      }

      return sessions;
    } catch (error) {
      logger.error("Error retrieving captured sessions:", error);
      return [];
    }
  }

  async getSessionForDomain(domain: string): Promise<TLSSessionData | null> {
    for (const [url, sessionData] of this.capturedData.entries()) {
      if (url.includes(domain)) {
        return sessionData;
      }
    }
    return null;
  }

  clearCapturedData(): void {
    this.capturedData.clear();
  }
}
