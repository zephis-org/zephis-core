import * as crypto from 'crypto';
import * as forge from 'node-forge';
import { HKDF } from '../cryptography/hkdf';

export interface SessionKeys {
  masterSecret: Buffer;
  clientWriteKey: Buffer;
  serverWriteKey: Buffer;
  clientWriteIV: Buffer;
  serverWriteIV: Buffer;
  clientWriteMac: Buffer;
  serverWriteMac: Buffer;
}

export interface KeyMaterial {
  preMasterSecret: Buffer;
  clientRandom: Buffer;
  serverRandom: Buffer;
  sessionId: Buffer;
}

export class KeyExtraction {
  private readonly hkdf: HKDF;
  
  constructor() {
    this.hkdf = new HKDF();
  }

  public extractKeyMaterial(
    clientHello: Buffer,
    serverHello: Buffer,
    clientKeyExchange: Buffer,
    privateKey?: forge.pki.rsa.PrivateKey
  ): KeyMaterial | null {
    try {
      const clientRandom = this.extractClientRandom(clientHello);
      const serverRandom = this.extractServerRandom(serverHello);
      const sessionId = this.extractSessionId(serverHello);
      
      if (!privateKey) {
        throw new Error('Private key required for key extraction');
      }

      const preMasterSecret = this.extractPreMasterSecret(clientKeyExchange, privateKey);

      return {
        preMasterSecret,
        clientRandom,
        serverRandom,
        sessionId
      };
    } catch (error) {
      console.error('Key material extraction failed:', error);
      return null;
    }
  }

  private extractClientRandom(clientHello: Buffer): Buffer {
    // Client random is at offset 6, length 32
    return clientHello.subarray(6, 38);
  }

  private extractServerRandom(serverHello: Buffer): Buffer {
    // Server random is at offset 6, length 32
    return serverHello.subarray(6, 38);
  }

  private extractSessionId(serverHello: Buffer): Buffer {
    const sessionIdLength = serverHello[38];
    if (sessionIdLength === 0) {
      return Buffer.alloc(0);
    }
    return serverHello.subarray(39, 39 + sessionIdLength);
  }

  private extractPreMasterSecret(clientKeyExchange: Buffer, privateKey: forge.pki.rsa.PrivateKey): Buffer {
    // Skip handshake header (4 bytes) and length field (2 bytes for encrypted pre-master secret length)
    const encryptedPMS = clientKeyExchange.subarray(6);
    
    try {
      const decrypted = privateKey.decrypt(encryptedPMS.toString('binary'));
      return Buffer.from(decrypted, 'binary');
    } catch (error) {
      throw new Error('Failed to decrypt pre-master secret');
    }
  }

  public deriveSessionKeys(keyMaterial: KeyMaterial, cipherSuite: string): SessionKeys {
    const masterSecret = this.hkdf.deriveMasterSecret(
      keyMaterial.preMasterSecret,
      keyMaterial.clientRandom,
      keyMaterial.serverRandom
    );

    const keyBlock = this.hkdf.deriveTLSKeys(
      masterSecret,
      keyMaterial.clientRandom,
      keyMaterial.serverRandom,
      this.getKeyBlockSize(cipherSuite)
    );

    return this.splitKeyBlock(keyBlock, cipherSuite, masterSecret);
  }


  private getKeyBlockSize(cipherSuite: string): number {
    // Key block size calculation based on cipher suite
    const sizes: Record<string, number> = {
      'TLS_RSA_WITH_AES_128_CBC_SHA': 104, // 2*20 (MAC) + 2*16 (Key) + 2*16 (IV)
      'TLS_RSA_WITH_AES_256_CBC_SHA': 136, // 2*20 (MAC) + 2*32 (Key) + 2*16 (IV)
      'TLS_RSA_WITH_AES_128_CBC_SHA256': 104,
      'TLS_RSA_WITH_AES_256_CBC_SHA256': 136,
      'TLS_RSA_WITH_AES_128_GCM_SHA256': 80,  // 2*32 (Key) + 2*4 (Fixed IV) + 2*4 (Salt)
      'TLS_RSA_WITH_AES_256_GCM_SHA384': 112, // 2*32 (Key) + 2*4 (Fixed IV) + 2*4 (Salt) + 2*32 (MAC key for GCM)
    };

    return sizes[cipherSuite] || 136;
  }

  private splitKeyBlock(keyBlock: Buffer, cipherSuite: string, masterSecret: Buffer): SessionKeys {
    let offset = 0;
    
    // MAC keys
    const macKeySize = this.getMacKeySize(cipherSuite);
    const clientWriteMac = keyBlock.subarray(offset, offset + macKeySize);
    offset += macKeySize;
    const serverWriteMac = keyBlock.subarray(offset, offset + macKeySize);
    offset += macKeySize;

    // Encryption keys
    const encKeySize = this.getEncKeySize(cipherSuite);
    const clientWriteKey = keyBlock.subarray(offset, offset + encKeySize);
    offset += encKeySize;
    const serverWriteKey = keyBlock.subarray(offset, offset + encKeySize);
    offset += encKeySize;

    // IVs
    const ivSize = this.getIVSize(cipherSuite);
    const clientWriteIV = keyBlock.subarray(offset, offset + ivSize);
    offset += ivSize;
    const serverWriteIV = keyBlock.subarray(offset, offset + ivSize);

    return {
      masterSecret, // Use the actual master secret parameter
      clientWriteKey,
      serverWriteKey,
      clientWriteIV,
      serverWriteIV,
      clientWriteMac,
      serverWriteMac
    };
  }

  private getMacKeySize(cipherSuite: string): number {
    if (cipherSuite.includes('GCM')) return 0; // GCM mode doesn't use MAC keys
    if (cipherSuite.includes('SHA256') || cipherSuite.includes('SHA384')) return 32;
    return 20; // SHA-1
  }

  private getEncKeySize(cipherSuite: string): number {
    if (cipherSuite.includes('AES_256')) return 32;
    if (cipherSuite.includes('AES_128')) return 16;
    return 16; // Default
  }

  private getIVSize(cipherSuite: string): number {
    if (cipherSuite.includes('GCM')) return 4; // Fixed IV size for GCM
    return 16; // CBC mode IV size
  }

  public commitToKeys(sessionKeys: SessionKeys): string {
    const keysHash = crypto.createHash('sha256');
    keysHash.update(sessionKeys.masterSecret);
    keysHash.update(sessionKeys.clientWriteKey);
    keysHash.update(sessionKeys.serverWriteKey);
    keysHash.update(sessionKeys.clientWriteIV);
    keysHash.update(sessionKeys.serverWriteIV);
    keysHash.update(sessionKeys.clientWriteMac);
    keysHash.update(sessionKeys.serverWriteMac);
    
    return keysHash.digest('hex');
  }
}