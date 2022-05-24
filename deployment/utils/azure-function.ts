import * as pulumi from '@pulumi/pulumi';
import * as resources from '@pulumi/azure-native/resources';
import * as storage from '@pulumi/azure-native/storage';
import * as web from '@pulumi/azure-native/web';
import { tmpdir } from 'os';
import { mkdtempSync, copyFileSync, writeFileSync, mkdirSync, readFileSync } from 'fs';
import { join } from 'path';
import { createHash } from 'crypto';

function createFunctionFolder({
  name,
  functionDefinition,
  functionFile,
}: {
  name: string;
  functionDefinition: Record<string, any>;
  functionFile: string;
}) {
  const hostDir = mkdtempSync(join(tmpdir(), Math.random().toString(16).slice(2)));
  const fnDir = join(hostDir, name);
  mkdirSync(fnDir);

  writeFileSync(
    join(hostDir, 'host.json'),
    JSON.stringify(
      {
        version: '2.0',
      },
      null,
      2
    )
  );

  copyFileSync(functionFile, join(fnDir, 'index.js'));
  writeFileSync(join(fnDir, 'function.json'), JSON.stringify(functionDefinition, null, 2));

  return {
    checksum: createHash('sha256')
      .update(readFileSync(functionFile, 'utf-8'))
      .update(JSON.stringify(functionDefinition))
      .digest('hex'),
    dir: hostDir,
  };
}

export class AzureFunction {
  constructor(
    private config: {
      name: string;
      envName: string;
      functionFile: string;
      functionDefinition: Record<string, any>;
      env: Record<string, string>;
    }
  ) {}

  deployAsJob() {
    const resourceGroup = new resources.ResourceGroup(`hive-${this.config.envName}-fn-rg`);
    const storageAccount = new storage.StorageAccount(`hive${this.config.envName}fn`, {
      resourceGroupName: resourceGroup.name,
      sku: {
        name: storage.SkuName.Standard_LRS,
      },
      kind: storage.Kind.StorageV2,
    });

    const codeContainer = new storage.BlobContainer('functions', {
      resourceGroupName: resourceGroup.name,
      accountName: storageAccount.name,
    });

    const { dir, checksum } = createFunctionFolder({
      name: this.config.name,
      functionDefinition: this.config.functionDefinition,
      functionFile: this.config.functionFile,
    });

    const codeBlob = new storage.Blob(this.config.name, {
      resourceGroupName: resourceGroup.name,
      accountName: storageAccount.name,
      containerName: codeContainer.name,
      source: new pulumi.asset.FileArchive(dir),
    });

    const plan = new web.AppServicePlan('plan', {
      resourceGroupName: resourceGroup.name,
      sku: {
        name: 'Y1',
        tier: 'Dynamic',
      },
    });

    const storageConnectionString = getConnectionString(resourceGroup.name, storageAccount.name);
    const codeBlobUrl = signedBlobReadUrl(codeBlob, codeContainer, storageAccount, resourceGroup);

    const app = new web.WebApp(
      `${this.config.name}-${this.config.envName}-fn`,
      {
        resourceGroupName: resourceGroup.name,
        serverFarmId: plan.id,
        kind: 'functionapp',
        siteConfig: {
          appSettings: [
            { name: 'AzureWebJobsStorage', value: storageConnectionString },
            { name: 'FUNCTIONS_EXTENSION_VERSION', value: '~3' },
            { name: 'FUNCTIONS_WORKER_RUNTIME', value: 'node' },
            { name: 'WEBSITE_NODE_DEFAULT_VERSION', value: '~16' },
            { name: 'WEBSITE_RUN_FROM_PACKAGE', value: codeBlobUrl },
            {
              name: 'FUNCTION_CHECKSUM',
              value: checksum,
            },
            ...Object.entries(this.config.env).map(([name, value]) => ({
              name,
              value,
            })),
          ],
          http20Enabled: true,
          nodeVersion: '~16',
        },
      },
      {
        additionalSecretOutputs: [],
      }
    );

    return {
      endpoint: pulumi.interpolate`https://${app.defaultHostName}/api/index`,
    };
  }
}

function getConnectionString(
  resourceGroupName: pulumi.Input<string>,
  accountName: pulumi.Input<string>
): pulumi.Output<string> {
  // Retrieve the primary storage account key.
  const storageAccountKeys = storage.listStorageAccountKeysOutput({
    resourceGroupName,
    accountName,
  });
  const primaryStorageKey = storageAccountKeys.keys[0].value;

  // Build the connection string to the storage account.
  return pulumi.interpolate`DefaultEndpointsProtocol=https;AccountName=${accountName};AccountKey=${primaryStorageKey}`;
}

function signedBlobReadUrl(
  blob: storage.Blob,
  container: storage.BlobContainer,
  account: storage.StorageAccount,
  resourceGroup: resources.ResourceGroup
): pulumi.Output<string> {
  const blobSAS = storage.listStorageAccountServiceSASOutput({
    accountName: account.name,
    protocols: storage.HttpProtocol.Https,
    sharedAccessExpiryTime: '2030-01-01',
    sharedAccessStartTime: '2021-01-01',
    resourceGroupName: resourceGroup.name,
    resource: storage.SignedResource.C,
    permissions: storage.Permissions.R,
    canonicalizedResource: pulumi.interpolate`/blob/${account.name}/${container.name}`,
    contentType: 'application/json',
    cacheControl: 'max-age=5',
    contentDisposition: 'inline',
    contentEncoding: 'deflate',
  });
  return pulumi.interpolate`https://${account.name}.blob.core.windows.net/${container.name}/${blob.name}?${blobSAS.serviceSasToken}`;
}
