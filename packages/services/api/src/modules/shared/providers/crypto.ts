import { Injectable, Scope, InjectionToken, Inject } from 'graphql-modules';
import crypto from 'crypto';

const ALG = 'aes256';
const IN_ENC = 'utf8';
const OUT_ENC = 'hex';
const IV = 16;

const ENCRYPTION_SECRET = new InjectionToken<string>('ENCRYPTION_SECRET');

export function encryptionSecretProvider(value: string) {
  return {
    provide: ENCRYPTION_SECRET,
    useValue: value,
    scope: Scope.Singleton,
  };
}

@Injectable({
  scope: Scope.Singleton,
})
export class CryptoProvider {
  encryptionSecret: string;

  constructor(@Inject(ENCRYPTION_SECRET) encryptionSecret: string) {
    this.encryptionSecret = crypto.createHash('md5').update(encryptionSecret).digest('hex');
  }

  encrypt(text: string) {
    const secretBuffer = Buffer.from(this.encryptionSecret, 'latin1');
    const iv = crypto.randomBytes(IV);
    const cipher = crypto.createCipheriv(ALG, secretBuffer, iv);
    const ciphered = cipher.update(text, IN_ENC, OUT_ENC) + cipher.final(OUT_ENC);
    return iv.toString(OUT_ENC) + ':' + ciphered;
  }

  decrypt(text: string, possiblyRaw?: boolean) {
    if (possiblyRaw) {
      // The result of `encrypt()` is `<iv(32 chars)>:<encrypted(n chars)>`
      // We're looking for this pattern here.
      // If it has more than 32 characters and `:` after 32 chars, it's encrypted.
      const isEncrypted = text.length > 32 && text.indexOf(':') === 32;

      if (!isEncrypted) {
        return text;
      }
    }

    const secretBuffer = Buffer.from(this.encryptionSecret, 'latin1');
    const components = text.split(':');
    const iv = Buffer.from(components.shift() || '', OUT_ENC);
    const decipher = crypto.createDecipheriv(ALG, secretBuffer, iv);

    return decipher.update(components.join(':'), OUT_ENC, IN_ENC) + decipher.final(IN_ENC);
  }
}
