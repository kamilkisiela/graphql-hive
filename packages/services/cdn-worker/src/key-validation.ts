import bcrypt from 'bcryptjs';
import { AwsClient } from 'packages/services/api/src/shared/aws';

const encoder = new TextEncoder();

export function byteStringToUint8Array(byteString: string) {
  const ui = new Uint8Array(byteString.length);

  for (let i = 0; i < byteString.length; ++i) {
    ui[i] = byteString.charCodeAt(i);
  }

  return ui;
}

export type KeyValidator = (targetId: string, headerKey: string) => Promise<boolean>;

type CreateKeyValidatorDeps = {
  keyData: string;
  s3: {
    endpoint: string;
    bucketName: string;
    client: AwsClient;
  };
};

export const createIsKeyValid =
  (deps: CreateKeyValidatorDeps): KeyValidator =>
  async (targetId: string, accessHeaderValue: string): Promise<boolean> => {
    const key = await deps.s3.client.fetch(
      [deps.s3.endpoint, deps.s3.bucketName, 'cdn-legacy-keys', targetId].join('/'),
      {
        method: 'GET',
      },
    );

    if (key.status !== 200) {
      return false;
    }

    return await bcrypt.compare(accessHeaderValue, await key.text());
  };
