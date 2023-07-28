import yargs from 'yargs';
import artifactFetch from './commands/artifact/fetch';
import configDelete from './commands/config/delete';
import configGet from './commands/config/get';
import configReset from './commands/config/reset';
import configSet from './commands/config/set';
import operationsCheck from './commands/operations/check';
import schemaCheck from './commands/schema/check';
import schemaDelete from './commands/schema/delete';
import schemaPublish from './commands/schema/publish';
import whoami from './commands/whoami';
import { buildContext } from './helpers/command';
import { processArgs } from './helpers/process';
import { version } from './version';

const commands = [
  whoami,
  schemaCheck,
  schemaDelete,
  schemaPublish,
  operationsCheck,
  artifactFetch,
  configDelete,
  configGet,
  configReset,
  configSet,
];

const root = yargs(processArgs)
  .scriptName('hive')
  .epilog('Visit https://the-guild.dev/graphql/hive for more information')
  .detectLocale(false)
  .parserConfiguration({
    'dot-notation': false,
    'sort-commands': true,
  })

  .version(version);
const ctx = buildContext();

void commands
  .reduce((cli, cmd) => cmd(cli, ctx), root)
  .help()
  .showHelpOnFail(false).argv;
