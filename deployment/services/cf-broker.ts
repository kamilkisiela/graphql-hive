import * as pulumi from '@pulumi/pulumi';
import { CloudflareBroker } from '../utils/cloudflare';
import { isProduction } from '../utils/helpers';

const commonConfig = new pulumi.Config('common');
const cfConfig = new pulumi.Config('cloudflareCustom');
const observabilityConfig = new pulumi.Config('observability');

const commonEnv = commonConfig.requireObject<Record<string, string>>('env');

export type Broker = ReturnType<typeof deployCFBroker>;

export function deployCFBroker({
  rootDns,
  envName,
  release,
}: {
  rootDns: string;
  envName: string;
  release: string;
}) {
  const cfBrokerSignature = commonConfig.requireSecret('cfBrokerSignature');
  const broker = new CloudflareBroker({
    envName,
    zoneId: cfConfig.require('zoneId'),
    // We can't cdn for staging env, since CF certificate only covers
    // one level of subdomains. See: https://community.cloudflare.com/t/ssl-handshake-error-cloudflare-proxy/175088
    // So for staging env, we are going to use `broker-staging` instead of `broker.staging`.
    cdnDnsRecord: isProduction(envName) ? `broker.${rootDns}` : `broker-${rootDns}`,
    secretSignature: cfBrokerSignature,
    sentryDsn: commonEnv.SENTRY_DSN,
    release,
    loki: observabilityConfig.getBoolean('enabled')
      ? {
          endpoint: observabilityConfig.require('lokiEndpoint'),
          username: observabilityConfig.require('lokiUsername'),
          password: observabilityConfig.requireSecret('lokiPassword'),
        }
      : null,
  });
  return broker.deploy();
}
