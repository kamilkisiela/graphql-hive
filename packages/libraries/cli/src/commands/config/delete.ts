import Command from '../../base-command';

export default class DeleteConfig extends Command {
  static description = 'deletes specific cli configuration';
  static args = [
    {
      name: 'key',
      required: true,
      description: 'config key',
    },
  ];

  async run() {
    const { args } = await this.parse(DeleteConfig);
    this._userConfig.set(args.key, args.value);
    this.success(
      this.bolderize(`Config flag "${args.key}" was set to "${args.value}"!`)
    );
  }
}
