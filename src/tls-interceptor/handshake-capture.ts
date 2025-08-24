import { TLSSocket } from 'tls';
import * as forge from 'node-forge';

export interface TLSHandshakeData {
  clientHello: Buffer;
  serverHello: Buffer;
  serverCertificate: Buffer;
  serverKeyExchange?: Buffer;
  clientKeyExchange: Buffer;
  finished: Buffer;
  timestamp: number;
}

export interface CipherSuite {
  id: number;
  name: string;
  keyExchange: string;
  cipher: string;
  hash: string;
}

export class HandshakeCapture {
  private handshakeData: Partial<TLSHandshakeData> = {};
  private messageBuffer: Buffer = Buffer.alloc(0);
  private isCapturing = false;

  constructor(private socket: TLSSocket) {
    this.setupInterception();
  }

  private setupInterception(): void {
    this.socket.on('secureConnect', () => {
      this.isCapturing = true;
      this.handshakeData.timestamp = Date.now();
    });

    this.socket.on('data', (data: Buffer) => {
      if (this.isCapturing) {
        this.processHandshakeData(data);
      }
    });
  }

  private processHandshakeData(data: Buffer): void {
    this.messageBuffer = Buffer.concat([this.messageBuffer, data]);
    this.parseHandshakeMessages();
  }

  private parseHandshakeMessages(): void {
    while (this.messageBuffer.length >= 5) {
      const contentType = this.messageBuffer[0];
      const version = this.messageBuffer.readUInt16BE(1);
      const length = this.messageBuffer.readUInt16BE(3);

      if (this.messageBuffer.length < 5 + length) {
        break;
      }

      const message = this.messageBuffer.subarray(5, 5 + length);
      this.messageBuffer = this.messageBuffer.subarray(5 + length);

      this.processHandshakeMessage(contentType, version, message);
    }
  }

  private processHandshakeMessage(contentType: number, _version: number, message: Buffer): void {
    if (contentType !== 22) return; // Only process handshake messages

    const handshakeType = message[0];

    switch (handshakeType) {
      case 1: // Client Hello
        this.handshakeData.clientHello = message;
        break;
      case 2: // Server Hello
        this.handshakeData.serverHello = message;
        break;
      case 11: // Certificate
        this.handshakeData.serverCertificate = message;
        break;
      case 12: // Server Key Exchange
        this.handshakeData.serverKeyExchange = message;
        break;
      case 16: // Client Key Exchange
        this.handshakeData.clientKeyExchange = message;
        break;
      case 20: // Finished
        this.handshakeData.finished = message;
        this.isCapturing = false;
        break;
    }
  }

  public getHandshakeData(): TLSHandshakeData | null {
    if (!this.isComplete()) {
      return null;
    }
    return this.handshakeData as TLSHandshakeData;
  }

  private isComplete(): boolean {
    return !!(
      this.handshakeData.clientHello &&
      this.handshakeData.serverHello &&
      this.handshakeData.serverCertificate &&
      this.handshakeData.clientKeyExchange &&
      this.handshakeData.finished
    );
  }

  public parseCipherSuite(serverHello: Buffer): CipherSuite | null {
    try {
      const cipherSuiteId = serverHello.readUInt16BE(39);
      return this.getCipherSuiteById(cipherSuiteId);
    } catch (error) {
      return null;
    }
  }

  private getCipherSuiteById(id: number): CipherSuite | null {
    const cipherSuites: Record<number, CipherSuite> = {
      0x002F: { id: 0x002F, name: 'TLS_RSA_WITH_AES_128_CBC_SHA', keyExchange: 'RSA', cipher: 'AES_128_CBC', hash: 'SHA' },
      0x0035: { id: 0x0035, name: 'TLS_RSA_WITH_AES_256_CBC_SHA', keyExchange: 'RSA', cipher: 'AES_256_CBC', hash: 'SHA' },
      0x003C: { id: 0x003C, name: 'TLS_RSA_WITH_AES_128_CBC_SHA256', keyExchange: 'RSA', cipher: 'AES_128_CBC', hash: 'SHA256' },
      0x003D: { id: 0x003D, name: 'TLS_RSA_WITH_AES_256_CBC_SHA256', keyExchange: 'RSA', cipher: 'AES_256_CBC', hash: 'SHA256' },
      0x009C: { id: 0x009C, name: 'TLS_RSA_WITH_AES_128_GCM_SHA256', keyExchange: 'RSA', cipher: 'AES_128_GCM', hash: 'SHA256' },
      0x009D: { id: 0x009D, name: 'TLS_RSA_WITH_AES_256_GCM_SHA384', keyExchange: 'RSA', cipher: 'AES_256_GCM', hash: 'SHA384' },
    };

    return cipherSuites[id] || null;
  }

  public validateCertificateChain(certificateMessage: Buffer): boolean {
    try {
      const certificates = this.parseCertificateMessage(certificateMessage);
      return certificates.length > 0;
    } catch (error) {
      return false;
    }
  }

  private parseCertificateMessage(message: Buffer): forge.pki.Certificate[] {
    const certificates: forge.pki.Certificate[] = [];
    let offset = 7; // Skip handshake header + certificate list length

    while (offset < message.length) {
      const certLength = message.readUIntBE(offset, 3);
      offset += 3;

      if (offset + certLength > message.length) {
        break;
      }

      const certData = message.subarray(offset, offset + certLength);
      try {
        const cert = forge.pki.certificateFromPem(certData.toString('binary'));
        certificates.push(cert);
      } catch (error) {
        console.warn('Failed to parse certificate:', error);
      }

      offset += certLength;
    }

    return certificates;
  }
}