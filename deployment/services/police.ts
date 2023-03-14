import * as pulumi from '@pulumi/pulumi';
import { HivePolice } from '../utils/police';

const cfCustomConfig = new pulumi.Config('cloudflareCustom');
const cloudflareProviderConfig = new pulumi.Config('cloudflare');

export function deployCloudflarePolice({ envName, rootDns }: { envName: string; rootDns: string }) {
  const police = new HivePolice(
    envName,
    cfCustomConfig.require('zoneId'),
    cloudflareProviderConfig.require('accountId'),
    cfCustomConfig.requireSecret('policeApiToken'),
    rootDns,
  );

  return police.deploy();
}
