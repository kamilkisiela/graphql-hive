import * as pulumi from '@pulumi/pulumi';
import { ServiceSecret } from '../secrets';
import { CloudflareCDN } from '../utils/cloudflare';
import { isProduction } from '../utils/helpers';
import { S3 } from './s3';
import { Sentry } from './sentry';

export type CDN = ReturnType<typeof deployCFCDN>;

export class CDNSecret extends ServiceSecret<{
  authPrivateKey: string | pulumi.Output<string>;
  baseUrl: string | pulumi.Output<string>;
}> {}

export function deployCFCDN({
  rootDns,
  release,
  envName,
  s3,
  sentry,
}: {
  rootDns: string;
  envName: string;
  release: string;
  s3: S3;
  sentry: Sentry;
}) {
  const cfConfig = new pulumi.Config('cloudflareCustom');

  const cdn = new CloudflareCDN({
    envName,
    zoneId: cfConfig.require('zoneId'),
    // We can't cdn for staging env, since CF certificate only covers
    // one level of subdomains. See: https://community.cloudflare.com/t/ssl-handshake-error-cloudflare-proxy/175088
    // So for staging env, we are going to use `cdn-staging` instead of `cdn.staging`.
    cdnDnsRecord: isProduction(envName) ? `cdn.${rootDns}` : `cdn-${rootDns}`,
    sentryDsn: sentry.enabled && sentry.secret ? sentry.secret?.raw.dsn : '',
    release,
    s3,
  });

  const deployedCdn = cdn.deploy();
  const cdnConfig = new pulumi.Config('cdn');
  const secret = new CDNSecret('cdn', {
    authPrivateKey: cdnConfig.requireSecret('authPrivateKey'),
    baseUrl: deployedCdn.workerBaseUrl,
  });

  return {
    cdn: deployedCdn,
    secret,
  };
}
