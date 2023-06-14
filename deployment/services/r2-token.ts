import * as cf from '@pulumi/cloudflare';

// These are hardcoded in CloudFlare APIs, under permission_groups.
const R2_READ_PERMISSION_GROUP_ID = 'b4992e1108244f5d8bfbd5744320c2e1';
const R2_WRITE_PERMISSION_GROUP_ID = 'bf7481a1826f439697cb59a20b22293e';

export function provisionCloudflareR2AccessToken(
  params: {
    envName: string;
    cloudflareAccountId: string;
  },
  input: {
    tokenName: string;
    read: boolean;
    write: boolean;
    allowedIps?: string[];
    expiration?: Date;
  },
) {
  const permissionGroups: string[] = [];

  if (input.read) {
    permissionGroups.push(R2_READ_PERMISSION_GROUP_ID);
  }
  if (input.write) {
    permissionGroups.push(R2_WRITE_PERMISSION_GROUP_ID);
  }

  const resource = new cf.ApiToken(`${input.tokenName}-${params.envName}`, {
    name: `${input.tokenName} (${params.envName})`,
    expiresOn: input.expiration?.toISOString() ?? undefined,
    condition: {
      requestIp: {
        ins: input.allowedIps ?? [],
        notIns: [],
      },
    },
    policies: [
      {
        effect: 'allow',
        resources: {
          [`com.cloudflare.api.account.${params.cloudflareAccountId}`]: '*',
        },
        permissionGroups,
      },
    ],
  });

  return {
    accessKeyId: resource.id,
    secretAccessKey: resource.value,
  };
}
