import * as pulumi from '@pulumi/pulumi';
import { CloudflareCDN } from '../utils/cdn';

const commonConfig = new pulumi.Config('common');
const cfConfig = new pulumi.Config('cloudflareCustom');

export type Cloudflare = ReturnType<typeof deployCloudflare>;

export function deployCloudflare({
  rootDns,
  envName,
}: {
  rootDns: string;
  envName: string;
}) {
  const cdnAuthPrivateKey = commonConfig.requireSecret('cdnAuthPrivateKey');
  const cdn = new CloudflareCDN(
    envName,
    cfConfig.require('zoneId'),
    // We can't use `cdn.staging.graphql-hive.com` for staging env, since CF certificate only covers
    // one level of subdomains. See: https://community.cloudflare.com/t/ssl-handshake-error-cloudflare-proxy/175088
    // So for staging env, we are going to use `cdn-staging` instead of `cdn.staging`.
    envName === 'staging' ? `cdn-${rootDns}` : `cdn.${rootDns}`,
    cdnAuthPrivateKey
  );
  return cdn.deploy();
}
