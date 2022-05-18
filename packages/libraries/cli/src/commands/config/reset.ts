import Command from '../../base-command';

export default class ResetConfig extends Command {
  static description = 'resets local cli configuration';

  async run() {
    this._userConfig.clear();
    this.success('Config cleared.');
  }
}
