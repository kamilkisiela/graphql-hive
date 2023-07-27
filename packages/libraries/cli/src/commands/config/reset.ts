import { createCommand } from '../../helpers/command';

export default createCommand((yargs, ctx) => {
  return yargs.command(
    'config:reset',
    'resets local cli configuration',
    y => y,
    async () => {
      ctx.userConfig.clear();
      ctx.logger.success(ctx.bolderize('Config cleared.'));
    },
  );
});
