import { readFileSync } from 'fs';
import { resolve } from 'path';
import * as cf from '@pulumi/cloudflare';
import * as pulumi from '@pulumi/pulumi';
import { Environment } from './environment';

export function deployFederationDemo(args: { environment: Environment }) {
  const cfConfig = new pulumi.Config('cloudflareCustom');

  const reviewsScript = new cf.WorkerScript('hive-federation-demo', {
    content: readFileSync(
      // eslint-disable-next-line no-process-env
      process.env.CDN_FEDERATION_DEMO_PATH ||
        resolve(__dirname, '../../packages/services/demo/federation/dist/main.js'),
      'utf-8',
    ),
    name: `hive-federation-demo-${args.environment.envName}`,
    module: true,
  });

  const workerBase = `demo-federation-${args.environment.rootDns}`;
  const workerUrl = `https://${workerBase}`;

  new cf.WorkerRoute('hive-federation-demo', {
    scriptName: reviewsScript.name,
    pattern: `${workerBase}/*`,
    zoneId: cfConfig.require('zoneId'),
  });

  return {
    workerBaseUrl: workerUrl,
  };
}
