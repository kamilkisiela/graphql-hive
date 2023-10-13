/**
 * Note: This file needs to run both on Node.js and Cloudflare Workers.
 */
import * as bc from 'bcryptjs';

export interface CDNToken {
  keyId: string;
  privateKey: string;
}

/**
 * We prefix the token so we can check fast wether a token is a new one or a legacy one.
 */
const keyPrefix = 'hv2';

/**
 * Encode a CDN token into a hex string with prefix.
 */
export function encodeCdnToken(args: CDNToken): string {
  const keyContents = [args.keyId, args.privateKey].join(':');
  return keyPrefix + globalThis.btoa(keyContents);
}

export function isCDNAccessToken(token: string) {
  return token.startsWith(keyPrefix) === true;
}

const decodeError = { type: 'failure', reason: 'Invalid access token.' } as const;

/**
 * Safely decode a CDN token that got serialized as a string.
 */
export function decodeCdnAccessTokenSafe(token: string) {
  if (isCDNAccessToken(token) === false) {
    return decodeError;
  }

  token = token.slice(keyPrefix.length);

  let str: string;

  try {
    str = globalThis.atob(token);
  } catch (error) {
    return decodeError;
  }

  const [keyId, privateKey] = str.split(':');
  if (keyId && privateKey) {
    return { type: 'success', token: { keyId, privateKey } } as const;
  }
  return decodeError;
}

/**
 * Verify whether a CDN token is valid.
 */
export async function verifyCdnToken(privateKey: string, privateKeyHash: string) {
  return bc.compare(privateKey, privateKeyHash);
}

export function generatePrivateKey(): string {
  const array = new Uint32Array(5);
  crypto.getRandomValues(array);
  return Array.from(array, dec2hex).join('');
}

function dec2hex(dec: number) {
  return dec.toString(16).padStart(2, '0');
}
