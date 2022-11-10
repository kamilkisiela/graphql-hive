import Command from '../../base-command';

export default class ResetConfig extends Command {
  static description = 'resets local cli configuration';

  // eslint-disable-next-line @typescript-eslint/require-await -- Command.run returns PromiseLike
  async run() {
    this._userConfig.clear();
    this.success('Config cleared.');
  }
}
