import * as cf from '@pulumi/cloudflare';
import * as pulumi from '@pulumi/pulumi';
import { readFileSync } from 'fs';
import { resolve } from 'path';

export class CloudflareCDN {
  constructor(
    private envName: string,
    private zoneId: string,
    private cdnDnsRecord: string,
    private authPrivateKey: pulumi.Output<string>
  ) {}

  deploy() {
    const kvStorage = new cf.WorkersKvNamespace('hive-ha-storage', {
      title: `hive-ha-cdn-${this.envName}`,
    });

    const script = new cf.WorkerScript('hive-ha-worker', {
      content: readFileSync(resolve(__dirname, '../../packages/services/cdn-worker/dist/worker.js'), 'utf-8'),
      name: `hive-storage-cdn-${this.envName}`,
      kvNamespaceBindings: [
        {
          // HIVE_DATA is in use in cdn-script.js as well, its the name of the global variable
          name: 'HIVE_DATA',
          namespaceId: kvStorage.id,
        },
      ],
      secretTextBindings: [
        {
          // KEY_DATA is in use in cdn-script.js as well, its the name of the global variable,
          // basically it's the private key for the hmac key.
          name: 'KEY_DATA',
          text: this.authPrivateKey,
        },
      ],
    });

    const workerBase = this.cdnDnsRecord;
    const workerUrl = `https://${workerBase}`;

    new cf.WorkerRoute('cf-hive-worker', {
      scriptName: script.name,
      pattern: `${workerBase}/*`,
      zoneId: this.zoneId,
    });

    return {
      authPrivateKey: this.authPrivateKey,
      workerBaseUrl: workerUrl,
      cfStorageNamespaceId: kvStorage.id,
    };
  }
}
