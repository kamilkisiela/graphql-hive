import * as pulumi from '@pulumi/pulumi';
import { CloudflareCDN } from '../utils/cloudflare';
import { isProduction } from '../utils/helpers';

const commonConfig = new pulumi.Config('common');
const cfConfig = new pulumi.Config('cloudflareCustom');

const commonEnv = commonConfig.requireObject<Record<string, string>>('env');

export type CDN = ReturnType<typeof deployCFCDN>;

export function deployCFCDN({
  rootDns,
  release,
  envName,
  s3Config,
}: {
  rootDns: string;
  envName: string;
  release: string;
  s3Config: {
    endpoint: string;
    bucketName: string;
    accessKeyId: pulumi.Output<string>;
    secretAccessKey: pulumi.Output<string>;
  };
}) {
  const cdn = new CloudflareCDN({
    envName,
    zoneId: cfConfig.require('zoneId'),
    accountId: cfConfig.require('accountId'),
    // We can't cdn for staging env, since CF certificate only covers
    // one level of subdomains. See: https://community.cloudflare.com/t/ssl-handshake-error-cloudflare-proxy/175088
    // So for staging env, we are going to use `cdn-staging` instead of `cdn.staging`.
    cdnDnsRecord: isProduction(envName) ? `cdn.${rootDns}` : `cdn-${rootDns}`,
    sentryDsn: commonEnv.SENTRY_DSN,
    release,
    s3Config,
  });

  return cdn.deploy();
}
