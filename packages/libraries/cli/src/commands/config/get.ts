import Command from '../../base-command';

export default class GetConfig extends Command {
  static description = 'prints specific cli configuration';
  static args = [
    {
      name: 'key',
      required: true,
      description: 'config key',
    },
  ];

  async run() {
    const { args } = await this.parse(GetConfig);
    console.dir(this._userConfig.get(args.key));
  }
}
