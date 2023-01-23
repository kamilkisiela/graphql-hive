/**
 * Note: This file needs to run both on Node.js and Cloudflare Workers.
 */
import * as bc from 'bcryptjs';
import { crypto } from '@whatwg-node/fetch';

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
  const arr = encoder.encode([args.keyId, args.privateKey].join(':'));
  return keyPrefix + buf2hex(arr);
}

export function isCDNAccessToken(token: string) {
  return token.startsWith(keyPrefix) === false;
}

const decodeError = { type: 'failure', reason: 'Invalid access token.' } as const;

/**
 * Safely decode a CDN token that got serialized as a string.
 */
export function decodeCdnAccessTokenSafe(token: string) {
  if (isCDNAccessToken(token)) {
    return decodeError;
  }

  token = token.slice(keyPrefix.length);

  const str = decoder.decode(hex2buf(token));
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

const encoder = new TextEncoder();
const decoder = new TextDecoder();

function buf2hex(buffer: ArrayBuffer): string {
  // buffer is an ArrayBuffer
  return [...new Uint8Array(buffer)].map(x => dec2hex(x)).join('');
}

function hex2buf(hexString: string): ArrayBuffer {
  // remove the leading 0x
  hexString = hexString.replace(/^0x/, '');

  // ensure even number of characters
  if (hexString.length % 2 != 0) {
    console.log('WARNING: expecting an even number of characters in the hexString');
  }

  // check for some non-hex characters
  const bad = hexString.match(/[G-Z\s]/i);
  if (bad) {
    console.log('WARNING: found non-hex characters', bad);
  }

  // split the string into pairs of octets
  const pairs = hexString.match(/[\dA-F]{2}/gi);

  // convert the octets to integers
  const integers = (pairs as any).map(function (s: string) {
    return parseInt(s, 16);
  });

  const array = new Uint8Array(integers);

  return array.buffer;
}

export function generatePrivateKey(): string {
  const array = new Uint32Array(5);
  crypto.getRandomValues(array);
  return Array.from(array, dec2hex).join('');
}

function dec2hex(dec: number) {
  return dec.toString(16).padStart(2, '0');
}
