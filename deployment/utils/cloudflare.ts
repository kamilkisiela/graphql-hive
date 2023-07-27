import { readFileSync } from 'fs';
import { resolve } from 'path';
import * as cf from '@pulumi/cloudflare';
import * as pulumi from '@pulumi/pulumi';

export class CloudflareCDN {
  constructor(
    private config: {
      envName: string;
      zoneId: string;
      cdnDnsRecord: string;
      sentryDsn: string;
      release: string;
      s3Config: {
        endpoint: string;
        bucketName: string;
        accessKeyId: pulumi.Output<string>;
        secretAccessKey: pulumi.Output<string>;
      };
    },
  ) {}

  deploy() {
    const kvStorage = new cf.WorkersKvNamespace('hive-ha-storage', {
      title: `hive-ha-cdn-${this.config.envName}`,
    });

    const script = new cf.WorkerScript('hive-ha-worker', {
      content: readFileSync(
        // eslint-disable-next-line no-process-env
        process.env.CDN_WORKER_ARTIFACT_PATH ||
          resolve(__dirname, '../../packages/services/cdn-worker/dist/index.worker.mjs'),
        'utf-8',
      ),
      name: `hive-storage-cdn-${this.config.envName}`,
      module: true,
      kvNamespaceBindings: [
        {
          // HIVE_DATA is in use in cdn-script.js as well, its the name of the global variable
          name: 'HIVE_DATA',
          namespaceId: kvStorage.id,
        },
      ],
      analyticsEngineBindings: [
        {
          name: 'USAGE_ANALYTICS',
          dataset: `hive_ha_cdn_usage_${this.config.envName}`,
        },
        {
          name: 'ERROR_ANALYTICS',
          dataset: `hive_ha_cdn_error_${this.config.envName}`,
        },
        {
          name: 'KEY_VALIDATION_ANALYTICS',
          dataset: `hive_ha_cdn_key_validation_${this.config.envName}`,
        },
      ],
      secretTextBindings: [
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
        {
          name: 'S3_ENDPOINT',
          text: this.config.s3Config.endpoint,
        },
        {
          name: 'S3_ACCESS_KEY_ID',
          text: this.config.s3Config.accessKeyId,
        },
        {
          name: 'S3_SECRET_ACCESS_KEY',
          text: this.config.s3Config.secretAccessKey,
        },
        {
          name: 'S3_BUCKET_NAME',
          text: this.config.s3Config.bucketName,
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
      loki: null | {
        endpoint: string;
        username: string;
        password: pulumi.Output<string>;
      };
    },
  ) {}

  deploy() {
    const secretTextBindings = [
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
    ];

    if (this.config.loki) {
      secretTextBindings.push(
        {
          name: 'LOKI_PASSWORD',
          text: this.config.loki.password,
        },
        {
          name: 'LOKI_USERNAME',
          text: this.config.loki.username,
        },
        {
          name: 'LOKI_ENDPOINT',
          text: this.config.loki.endpoint,
        },
      );
    }

    const script = new cf.WorkerScript('hive-broker-worker', {
      content: readFileSync(
        // eslint-disable-next-line no-process-env
        process.env.BROKER_WORKER_ARTIFACT_PATH ||
          resolve(__dirname, '../../packages/services/broker-worker/dist/index.worker.js'),
        'utf-8',
      ),
      name: `hive-broker-${this.config.envName}`,
      secretTextBindings,
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
