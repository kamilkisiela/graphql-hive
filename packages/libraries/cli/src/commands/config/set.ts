import { Args } from '@oclif/core';
import Command from '../../base-command';
import { allowedKeys, ValidConfigurationKeys } from '../../helpers/config';

export default class SetConfig extends Command {
  static description = 'updates specific cli configuration';
  static args = {
    key: Args.string({
      name: 'key',
      required: true,
      description: 'config key',
      options: allowedKeys,
    }),
    value: Args.string({
      name: 'value',
      required: true,
      description: 'config value',
    }),
  };

  async run() {
    const { args } = await this.parse(SetConfig);
    this._userConfig.set(args.key as ValidConfigurationKeys, args.value);
    this.success(this.bolderize(`Config flag "${args.key}" was set to "${args.value}"`));
  }
}
