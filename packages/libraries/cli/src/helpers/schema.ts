import colors from 'colors';
import { concatAST, print } from 'graphql';
import { CodeFileLoader } from '@graphql-tools/code-file-loader';
import { GraphQLFileLoader } from '@graphql-tools/graphql-file-loader';
import { JsonFileLoader } from '@graphql-tools/json-file-loader';
import { loadTypedefs } from '@graphql-tools/load';
import { UrlLoader } from '@graphql-tools/url-loader';
import {
  CriticalityLevel,
  SchemaChangeConnection,
  SchemaErrorConnection,
  SchemaWarningConnection,
} from '../gql/graphql';
import type { Context } from './command';
import { processCwd } from './process';

const indent = '  ';

const criticalityMap: Record<CriticalityLevel, string> = {
  [CriticalityLevel.Breaking]: colors.red('-'),
  [CriticalityLevel.Safe]: colors.green('-'),
  [CriticalityLevel.Dangerous]: colors.yellow('-'),
};

export function renderErrors(ctx: Context, errors: SchemaErrorConnection) {
  ctx.logger.fail(`Detected ${errors.total} error${errors.total > 1 ? 's' : ''}`);
  ctx.logger.log('');

  errors.nodes.forEach(error => {
    ctx.logger.log(String(indent), colors.red('-'), ctx.bolderize(error.message));
  });
}

export function renderChanges(ctx: Context, changes: SchemaChangeConnection) {
  ctx.logger.info(`Detected ${changes.total} change${changes.total > 1 ? 's' : ''}`);
  ctx.logger.log('');

  changes.nodes.forEach(change => {
    ctx.logger.log(indent, criticalityMap[change.criticality], ctx.bolderize(change.message));
  });
}

export function renderWarnings(ctx: Context, warnings: SchemaWarningConnection) {
  ctx.logger.log('');
  ctx.logger.infoWarning(`Detected ${warnings.total} warning${warnings.total > 1 ? 's' : ''}`);
  ctx.logger.log('');

  warnings.nodes.forEach(warning => {
    const details = [warning.source ? `source: ${ctx.bolderize(warning.source)}` : undefined]
      .filter(Boolean)
      .join(', ');

    ctx.logger.log(indent, `- ${ctx.bolderize(warning.message)}${details ? ` (${details})` : ''}`);
  });
}

export async function loadSchema(file: string) {
  const sources = await loadTypedefs(file, {
    cwd: processCwd,
    loaders: [new CodeFileLoader(), new GraphQLFileLoader(), new JsonFileLoader(), new UrlLoader()],
  });

  return print(concatAST(sources.map(s => s.document!)));
}

export function minifySchema(schema: string): string {
  return schema.replace(/\s+/g, ' ').trim();
}
