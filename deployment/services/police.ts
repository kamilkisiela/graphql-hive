import * as pulumi from '@pulumi/pulumi';
import { HivePolice } from '../utils/police';

const cfCustomConfig = new pulumi.Config('cloudflareCustom');

export function deployCloudflarePolice({
  envName,
  rootDns,
}: {
  envName: string;
  rootDns: string;
}) {
  const police = new HivePolice(
    envName,
    cfCustomConfig.require('zoneId'),
    cfCustomConfig.requireSecret('policeApiToken'),
    rootDns
  );

  return police.deploy();
}
