import { createCommand } from '../../helpers/command';
import { coerceToAllowedKey } from '../../helpers/config';

export default createCommand((yargs, ctx) => {
  return yargs.command(
    'config:get <key>',
    'prints specific cli configuration',
    y =>
      y.positional('key', {
        type: 'string',
        description: 'config key',
        coerce: coerceToAllowedKey,
        demandOption: true,
      }),
    async args => {
      console.dir(ctx.userConfig.get(args.key));
    },
  );
});
