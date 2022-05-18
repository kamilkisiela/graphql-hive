import colors from 'colors';
import { print, concatAST } from 'graphql';
import { loadTypedefs } from '@graphql-tools/load';
import { CodeFileLoader } from '@graphql-tools/code-file-loader';
import { GraphQLFileLoader } from '@graphql-tools/graphql-file-loader';
import { JsonFileLoader } from '@graphql-tools/json-file-loader';
import { UrlLoader } from '@graphql-tools/url-loader';
import {
  CriticalityLevel,
  SchemaChangeConnection,
  SchemaErrorConnection,
} from '../sdk';
import baseCommand from '../base-command';

const indent = '  ';

const criticalityMap: Record<CriticalityLevel, string> = {
  [CriticalityLevel.Breaking]: colors.red('-'),
  [CriticalityLevel.Safe]: colors.green('-'),
  [CriticalityLevel.Dangerous]: colors.yellow('-'),
};

export function renderErrors(this: baseCommand, errors: SchemaErrorConnection) {
  this.fail(`Detected ${errors.total} error${errors.total > 1 ? 's' : ''}`);
  this.log('');

  errors.nodes.forEach((error) => {
    this.log(`${indent}`, colors.red('-'), this.bolderize(error.message));
  });
}

export function renderChanges(
  this: baseCommand,
  changes: SchemaChangeConnection
) {
  this.info(`Detected ${changes.total} change${changes.total > 1 ? 's' : ''}`);
  this.log('');

  changes.nodes.forEach((change) => {
    this.log(
      indent,
      criticalityMap[change.criticality],
      this.bolderize(change.message)
    );
  });
}

export async function loadSchema(file: string) {
  const sources = await loadTypedefs(file, {
    cwd: process.cwd(),
    loaders: [
      new CodeFileLoader(),
      new GraphQLFileLoader(),
      new JsonFileLoader(),
      new UrlLoader(),
    ],
  });

  return print(concatAST(sources.map((s) => s.document!)));
}

export function minifySchema(schema: string): string {
  return schema.replace(/\s+/g, ' ').trim();
}
