import * as cf from '@pulumi/cloudflare';
import * as pulumi from '@pulumi/pulumi';
import { readFileSync } from 'fs';
import { resolve } from 'path';

export class CloudflareCDN {
  constructor(
    private config: {
      envName: string;
      zoneId: string;
      cdnDnsRecord: string;
      authPrivateKey: pulumi.Output<string>;
      sentryDsn: string;
      release: string;
    },
  ) {}

  deploy() {
    const kvStorage = new cf.WorkersKvNamespace('hive-ha-storage', {
      title: `hive-ha-cdn-${this.config.envName}`,
    });

    const script = new cf.WorkerScript('hive-ha-worker', {
      content: readFileSync(
        resolve(__dirname, '../../packages/services/cdn-worker/dist/worker.js'),
        'utf-8',
      ),
      name: `hive-storage-cdn-${this.config.envName}`,
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
          text: this.config.authPrivateKey,
        },
        {
          name: 'SENTRY_DSN',
          text: this.config.sentryDsn,
        },
        {
          name: 'SENTRY_ENVIRONMENT',
          text: this.config.envName,
        },
        {
          name: 'SENTRY_RELEASE',
          text: this.config.release,
        },
      ],
    });

    const workerBase = this.config.cdnDnsRecord;
    const workerUrl = `https://${workerBase}`;

    new cf.WorkerRoute('cf-hive-worker', {
      scriptName: script.name,
      pattern: `${workerBase}/*`,
      zoneId: this.config.zoneId,
    });

    return {
      authPrivateKey: this.config.authPrivateKey,
      workerBaseUrl: workerUrl,
      cfStorageNamespaceId: kvStorage.id,
    };
  }
}

export class CloudflareBroker {
  constructor(
    private config: {
      envName: string;
      zoneId: string;
      cdnDnsRecord: string;
      secretSignature: pulumi.Output<string>;
      sentryDsn: string;
      release: string;
    },
  ) {}

  deploy() {
    const script = new cf.WorkerScript('hive-broker-worker', {
      content: readFileSync(
        resolve(__dirname, '../../packages/services/broker-worker/dist/worker.js'),
        'utf-8',
      ),
      name: `hive-broker-${this.config.envName}`,
      secretTextBindings: [
        {
          name: 'SIGNATURE',
          text: this.config.secretSignature,
        },
        {
          name: 'SENTRY_DSN',
          text: this.config.sentryDsn,
        },
        {
          name: 'SENTRY_ENVIRONMENT',
          text: this.config.envName,
        },
        {
          name: 'SENTRY_RELEASE',
          text: this.config.release,
        },
      ],
    });

    const workerBase = this.config.cdnDnsRecord;
    const workerUrl = `https://${workerBase}`;

    new cf.WorkerRoute('cf-hive-broker-worker', {
      scriptName: script.name,
      pattern: `${workerBase}/*`,
      zoneId: this.config.zoneId,
    });

    return {
      secretSignature: this.config.secretSignature,
      workerBaseUrl: workerUrl,
    };
  }
}
