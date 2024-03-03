import * as pulumi from '@pulumi/pulumi';
import { CloudflareCDN } from '../utils/cloudflare';
import { ServiceSecret } from '../utils/secrets';
import { Environment } from './environment';
import { S3 } from './s3';
import { Sentry } from './sentry';

export type CDN = ReturnType<typeof deployCFCDN>;

export class CDNSecret extends ServiceSecret<{
  authPrivateKey: string | pulumi.Output<string>;
  baseUrl: string | pulumi.Output<string>;
}> {}

export function deployCFCDN({
  environment,
  s3,
  sentry,
}: {
  environment: Environment;
  s3: S3;
  sentry: Sentry;
}) {
  const cfConfig = new pulumi.Config('cloudflareCustom');

  const cdn = new CloudflareCDN({
    envName: environment.envName,
    zoneId: cfConfig.require('zoneId'),
    // We can't cdn for staging env, since CF certificate only covers
    // one level of subdomains. See: https://community.cloudflare.com/t/ssl-handshake-error-cloudflare-proxy/175088
    // So for staging env, we are going to use `cdn-staging` instead of `cdn.staging`.
    cdnDnsRecord: environment.isProduction
      ? `cdn.${environment.rootDns}`
      : `cdn-${environment.rootDns}`,
    sentryDsn: sentry.enabled && sentry.secret ? sentry.secret?.raw.dsn : '',
    release: environment.release,
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
