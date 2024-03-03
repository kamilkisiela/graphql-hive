import { Config, Output } from '@pulumi/pulumi';
import { ServiceSecret } from '../secrets';

export class DataEncryptionSecret extends ServiceSecret<{
  encryptionPrivateKey: string | Output<string>;
}> {}

export function prepareCommon(input: { release: string }) {
  const commonConfig = new Config('common');

  const encryptionSecret = new DataEncryptionSecret('data-encryption', {
    encryptionPrivateKey: commonConfig.requireSecret('encryptionSecret'),
  });

  return {
    env: {},
    encryptionSecret,
    release: input.release,
  };
}

export type Common = ReturnType<typeof prepareCommon>;
