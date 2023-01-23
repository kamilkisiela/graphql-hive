import { readFileSync } from 'fs';
import { resolve } from 'path';
import * as cf from '@pulumi/cloudflare';
import * as pulumi from '@pulumi/pulumi';

export class HivePolice {
  constructor(
    private envName: string,
    private zoneId: string,
    private accountId: string,
    private cfToken: pulumi.Output<string>,
    private rootDns: string,
  ) {}

  deploy() {
    const kvStorage = new cf.WorkersKvNamespace('hive-police-kv', {
      title: `hive-police-${this.envName}`,
    });

    const script = new cf.WorkerScript('hive-police-worker', {
      content: readFileSync(
        resolve(__dirname, '../../packages/services/police-worker/dist/index.worker.js'),
        'utf-8',
      ),
      name: `hive-police-${this.envName}`,
      kvNamespaceBindings: [
        {
          // HIVE_POLICE is in use in police-script js as well, its the name of the global variable
          name: 'HIVE_POLICE',
          namespaceId: kvStorage.id,
        },
      ],
      //
      secretTextBindings: [
        {
          name: 'CF_BEARER_TOKEN',
          text: this.cfToken,
        },
        {
          name: 'ZONE_IDENTIFIER',
          text: this.zoneId,
        },
        {
          name: 'HOSTNAMES',
          text: `${this.rootDns},app.${this.rootDns},cdn.${this.rootDns}`,
        },
        {
          name: 'WAF_RULE_NAME',
          text: `hive-police-rule-${this.envName}`,
        },
      ],
    });

    new cf.WorkerCronTrigger('cf-police-trigger', {
      accountId: this.accountId,
      scriptName: script.name,
      // https://developers.cloudflare.com/workers/platform/cron-triggers/#examples
      schedules: [
        '*/10 * * * *', // every 10 minutes
      ],
    });

    return {
      cfStorageNamespaceId: kvStorage.id,
    };
  }
}
