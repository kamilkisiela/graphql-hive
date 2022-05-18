export {};

declare global {
  /**
   * KV Storage for the CDN
   */
  let HIVE_DATA: KVNamespace;
  /**
   * Secret used to sign the CDN keys
   */
  let KEY_DATA: string;
}
