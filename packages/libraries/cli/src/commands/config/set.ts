import { createCommand } from '../../helpers/command';
import { coerceToAllowedKey } from '../../helpers/config';

export default createCommand((yargs, ctx) => {
  return yargs.command(
    'config:set <key> <value>',
    'updates specific cli configuration',
    y =>
      y
        .positional('key', {
          type: 'string',
          description: 'config key',
          coerce: coerceToAllowedKey,
          demandOption: true,
        })
        .positional('value', {
          type: 'string',
          description: 'config value',
          demandOption: true,
        }),
    async args => {
      ctx.userConfig.set(args.key, args.value);
      ctx.logger.success(ctx.bolderize(`Config flag "${args.key}" was set to "${args.value}"`));
    },
  );
});
