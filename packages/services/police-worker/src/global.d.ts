export {};

declare global {
  /**
   * KV Storage for the Police records
   */
  let HIVE_POLICE: KVNamespace;
  let ZONE_IDENTIFIER: string;
  let CF_BEARER_TOKEN: string;
  let HOSTNAMES: string;
  let WAF_RULE_NAME: string;
}
