import { Args } from '@oclif/core';
import Command from '../../base-command';
import { allowedKeys, ValidConfigurationKeys } from '../../helpers/config';

export default class GetConfig extends Command {
  static description = 'prints specific cli configuration';
  static args = {
    key: Args.string({
      name: 'key',
      required: true,
      description: 'config key',
      options: allowedKeys,
    }),
  };

  async run() {
    const { args } = await this.parse(GetConfig);
    console.dir(this._userConfig.get(args.key as ValidConfigurationKeys));
  }
}
