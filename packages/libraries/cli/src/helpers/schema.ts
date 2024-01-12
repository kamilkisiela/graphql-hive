import colors from 'colors';
import { concatAST, print } from 'graphql';
import { CodeFileLoader } from '@graphql-tools/code-file-loader';
import { GraphQLFileLoader } from '@graphql-tools/graphql-file-loader';
import { JsonFileLoader } from '@graphql-tools/json-file-loader';
import { loadTypedefs } from '@graphql-tools/load';
import { UrlLoader } from '@graphql-tools/url-loader';
import baseCommand from '../base-command';
import {
  CriticalityLevel,
  SchemaChange,
  SchemaChangeConnection,
  SchemaErrorConnection,
  SchemaWarningConnection,
} from '../gql/graphql';

const indent = '  ';

const criticalityMap: Record<CriticalityLevel, string> = {
  [CriticalityLevel.Breaking]: colors.red('-'),
  [CriticalityLevel.Safe]: colors.green('-'),
  [CriticalityLevel.Dangerous]: colors.yellow('-'),
};

export function renderErrors(this: baseCommand, errors: SchemaErrorConnection) {
  this.fail(`Detected ${errors.total} error${errors.total > 1 ? 's' : ''}`);
  this.log('');

  errors.nodes.forEach(error => {
    this.log(String(indent), colors.red('-'), this.bolderize(error.message));
  });
}

export function renderChanges(this: baseCommand, changes: SchemaChangeConnection) {
  const filterChangesByLevel = (level: CriticalityLevel) => {
    return (change: SchemaChange) => change.criticality === level;
  };
  const writeChanges = (changes: SchemaChangeConnection) => {
    changes.nodes.forEach(change => {
      this.log(indent + criticalityMap[change.criticality] + this.bolderize(change.message));
    });
  };

  this.info(`Detected ${changes.total} change${changes.total > 1 ? 's' : ''}`);
  this.log('');

  const breakingChanges = changes.nodes.filter(filterChangesByLevel(CriticalityLevel.Breaking));
  const dangerousChanges = changes.nodes.filter(filterChangesByLevel(CriticalityLevel.Dangerous));
  const safeChanges = changes.nodes.filter(filterChangesByLevel(CriticalityLevel.Safe));

  if (breakingChanges.length) {
    this.log(`Breaking: ${breakingChanges.length}`);
    writeChanges(changes);
  }

  if (dangerousChanges.length) {
    this.log(`Dangerous: ${dangerousChanges.length}`);
    writeChanges(changes);
  }

  if (safeChanges.length) {
    this.log(`Safe: ${safeChanges.length}`);
    writeChanges(changes);
  }

  changes.nodes.forEach(change => {
    this.log(indent, criticalityMap[change.criticality], this.bolderize(change.message));
  });
}

export function renderWarnings(this: baseCommand, warnings: SchemaWarningConnection) {
  this.log('');
  this.infoWarning(`Detected ${warnings.total} warning${warnings.total > 1 ? 's' : ''}`);
  this.log('');

  warnings.nodes.forEach(warning => {
    const details = [warning.source ? `source: ${this.bolderize(warning.source)}` : undefined]
      .filter(Boolean)
      .join(', ');

    this.log(indent, `- ${this.bolderize(warning.message)}${details ? ` (${details})` : ''}`);
  });
}

export async function loadSchema(
  file: string,
  options?: {
    headers?: Record<string, string>;
    method?: 'GET' | 'POST';
  },
) {
  const sources = await loadTypedefs(file, {
    ...options,
    cwd: process.cwd(),
    loaders: [new CodeFileLoader(), new GraphQLFileLoader(), new JsonFileLoader(), new UrlLoader()],
  });

  return print(concatAST(sources.map(s => s.document!)));
}

export function minifySchema(schema: string): string {
  return schema.replace(/\s+/g, ' ').trim();
}
