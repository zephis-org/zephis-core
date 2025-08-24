import * as crypto from 'crypto';

export interface HKDFParams {
  ikm: Buffer; // Input Keying Material
  salt?: Buffer; // Optional salt
  info?: Buffer; // Optional context info
  length: number; // Output length in bytes
  hash?: string; // Hash algorithm (default: sha256)
}

export class HKDF {
  private readonly DEFAULT_HASH = 'sha256';

  constructor() {}

  public extract(ikm: Buffer, salt?: Buffer, hash: string = this.DEFAULT_HASH): Buffer {
    const actualSalt = salt || Buffer.alloc(crypto.createHash(hash).digest().length);
    
    const hmac = crypto.createHmac(hash, actualSalt);
    hmac.update(ikm);
    return hmac.digest();
  }

  public expand(prk: Buffer, length: number, info?: Buffer, hash: string = this.DEFAULT_HASH): Buffer {
    const hashLen = crypto.createHash(hash).digest().length;
    const n = Math.ceil(length / hashLen);
    
    if (n > 255) {
      throw new Error('HKDF expand: requested length too large');
    }

    const t = Buffer.alloc(0);
    let okm = Buffer.alloc(0);
    
    for (let i = 1; i <= n; i++) {
      const hmac = crypto.createHmac(hash, prk);
      
      if (i > 1) {
        hmac.update(t);
      }
      
      if (info) {
        hmac.update(info);
      }
      
      hmac.update(Buffer.from([i]));
      
      const currentT = hmac.digest();
      okm = Buffer.concat([okm, currentT]);
      t.fill(0);
      currentT.copy(t);
    }

    return okm.subarray(0, length);
  }

  public derive(params: HKDFParams): Buffer {
    const prk = this.extract(params.ikm, params.salt, params.hash);
    return this.expand(prk, params.length, params.info, params.hash);
  }

  public deriveTLSKeys(
    masterSecret: Buffer,
    clientRandom: Buffer,
    serverRandom: Buffer,
    keyBlockLength: number
  ): Buffer {
    const label = Buffer.from('key expansion', 'utf8');
    const seed = Buffer.concat([label, serverRandom, clientRandom]);
    
    return this.derive({
      ikm: masterSecret,
      info: seed,
      length: keyBlockLength
    });
  }

  public deriveMasterSecret(
    preMasterSecret: Buffer,
    clientRandom: Buffer,
    serverRandom: Buffer
  ): Buffer {
    const label = Buffer.from('master secret', 'utf8');
    const seed = Buffer.concat([label, clientRandom, serverRandom]);
    
    return this.derive({
      ikm: preMasterSecret,
      info: seed,
      length: 48 // Master secret is always 48 bytes in TLS
    });
  }

  public deriveFinishedKeys(
    masterSecret: Buffer,
    handshakeHash: Buffer,
    isClient: boolean
  ): Buffer {
    const label = isClient ? 
      Buffer.from('client finished', 'utf8') : 
      Buffer.from('server finished', 'utf8');
    const seed = Buffer.concat([label, handshakeHash]);
    
    return this.derive({
      ikm: masterSecret,
      info: seed,
      length: 12 // Finished message is 12 bytes
    });
  }

  public derivePSK(
    sharedSecret: Buffer,
    clientRandom: Buffer,
    serverRandom: Buffer,
    pskLength: number = 32
  ): Buffer {
    const label = Buffer.from('zephis psk', 'utf8');
    const seed = Buffer.concat([label, clientRandom, serverRandom]);
    
    return this.derive({
      ikm: sharedSecret,
      info: seed,
      length: pskLength
    });
  }

  public deriveCommitmentKey(
    sessionKey: Buffer,
    context: Buffer,
    keyLength: number = 32
  ): Buffer {
    const label = Buffer.from('commitment key', 'utf8');
    const info = Buffer.concat([label, context]);
    
    return this.derive({
      ikm: sessionKey,
      info,
      length: keyLength
    });
  }

  public deriveProofKey(
    masterKey: Buffer,
    proofType: string,
    sessionId: Buffer,
    keyLength: number = 32
  ): Buffer {
    const label = Buffer.from(`${proofType} proof key`, 'utf8');
    const info = Buffer.concat([label, sessionId]);
    
    return this.derive({
      ikm: masterKey,
      info,
      length: keyLength
    });
  }

  public deriveMultipleKeys(
    ikm: Buffer,
    keySpecs: Array<{
      label: string;
      context?: Buffer;
      length: number;
    }>,
    salt?: Buffer
  ): Buffer[] {
    const prk = this.extract(ikm, salt);
    
    return keySpecs.map(spec => {
      const label = Buffer.from(spec.label, 'utf8');
      const info = spec.context ? 
        Buffer.concat([label, spec.context]) : 
        label;
      
      return this.expand(prk, spec.length, info);
    });
  }

  public verifyKeyDerivation(
    originalParams: HKDFParams,
    derivedKey: Buffer
  ): boolean {
    try {
      const expectedKey = this.derive(originalParams);
      return crypto.timingSafeEqual(derivedKey, expectedKey);
    } catch (error) {
      return false;
    }
  }

  public constantTimeCompare(a: Buffer, b: Buffer): boolean {
    if (a.length !== b.length) {
      return false;
    }
    
    return crypto.timingSafeEqual(a, b);
  }

  public secureRandomBytes(length: number): Buffer {
    return crypto.randomBytes(length);
  }

  public zeroMemory(buffer: Buffer): void {
    buffer.fill(0);
  }
}