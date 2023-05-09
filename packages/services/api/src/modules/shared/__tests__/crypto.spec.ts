import 'reflect-metadata';
import { testkit } from 'graphql-modules';
import { CryptoProvider, encryptionSecretProvider } from '../providers/crypto';

test('should decrypt encrypted value', () => {
  const cryptoProvider = testkit
    .testInjector([CryptoProvider, encryptionSecretProvider('secret')])
    .get(CryptoProvider);
  const encrypted = cryptoProvider.encrypt('foo');

  expect(cryptoProvider.decrypt(encrypted)).toBe('foo');
});

test('should read raw value when decrypting (when possiblyRaw is enabled)', () => {
  const cryptoProvider = testkit
    .testInjector([CryptoProvider, encryptionSecretProvider('secret')])
    .get(CryptoProvider);

  expect(cryptoProvider.decrypt('foo', true)).toBe('foo');
});

test('should NOT read raw value when decrypting', () => {
  const cryptoProvider = testkit
    .testInjector([CryptoProvider, encryptionSecretProvider('secret')])
    .get(CryptoProvider);

  expect(() => {
    cryptoProvider.decrypt('foo');
  }).toThrow();
});

test('should NOT decrypt value encrypted with different secret', () => {
  const aCryptoProvider = testkit
    .testInjector([CryptoProvider, encryptionSecretProvider('secret')])
    .get(CryptoProvider);
  const bCryptoProvider = testkit
    .testInjector([CryptoProvider, encryptionSecretProvider('other-secret')])
    .get(CryptoProvider);

  const encrypted = aCryptoProvider.encrypt('a');
  expect(() => {
    bCryptoProvider.decrypt(encrypted);
  }).toThrow();
});
