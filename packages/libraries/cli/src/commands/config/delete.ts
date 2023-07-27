import { createCommand } from '../../helpers/command';

export default createCommand((yargs, ctx) => {
  return yargs.command(
    'config:delete <key>',
    'deletes specific cli configuration',
    y =>
      y.positional('key', {
        type: 'string',
        description: 'config key',
        demandOption: true,
      }),
    async args => {
      ctx.userConfig.delete(args.key);
      ctx.logger.success(ctx.bolderize(`Config flag "${args.key}" was deleted`));
    },
  );
});
