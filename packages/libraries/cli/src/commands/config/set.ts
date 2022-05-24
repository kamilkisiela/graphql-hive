import Command from '../../base-command';

export default class SetConfig extends Command {
  static description = 'updates specific cli configuration';
  static args = [
    {
      name: 'key',
      required: true,
      description: 'config key',
    },
    {
      name: 'value',
      required: true,
      description: 'config value',
    },
  ];

  async run() {
    const { args } = await this.parse(SetConfig);
    this._userConfig.set(args.key, args.value);
    this.success(this.bolderize(`Config flag "${args.key}" was set to "${args.value}"!`));
  }
}
