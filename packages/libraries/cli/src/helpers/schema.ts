import colors from 'colors';
import { concatAST, print } from 'graphql';
import { CodeFileLoader } from '@graphql-tools/code-file-loader';
import { GraphQLFileLoader } from '@graphql-tools/graphql-file-loader';
import { JsonFileLoader } from '@graphql-tools/json-file-loader';
import { loadTypedefs } from '@graphql-tools/load';
import { UrlLoader } from '@graphql-tools/url-loader';
import baseCommand from '../base-command';
import { FragmentType, graphql, useFragment as unmaskFragment } from '../gql';
import { CriticalityLevel, SchemaErrorConnection, SchemaWarningConnection } from '../gql/graphql';

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

const RenderChanges_SchemaChanges = graphql(`
  fragment RenderChanges_schemaChanges on SchemaChangeConnection {
    total
    nodes {
      criticality
      isSafeBasedOnUsage
      message(withSafeBasedOnUsageNote: false)
      approval {
        approvedBy {
          displayName
        }
      }
    }
  }
`);

export function renderChanges(
  this: baseCommand,
  maskedChanges: FragmentType<typeof RenderChanges_SchemaChanges>,
) {
  const changes = unmaskFragment(RenderChanges_SchemaChanges, maskedChanges);
  type ChangeType = (typeof changes)['nodes'][number];

  const filterChangesByLevel = (level: CriticalityLevel) => {
    return (change: ChangeType) => change.criticality === level;
  };
  const writeChanges = (changes: ChangeType[]) => {
    changes.forEach(change => {
      const messageParts = [
        String(indent),
        criticalityMap[change.isSafeBasedOnUsage ? CriticalityLevel.Safe : change.criticality],
        this.bolderize(change.message),
      ];

      if (change.isSafeBasedOnUsage) {
        messageParts.push(colors.green('(Safe based on usage ✓)'));
      }
      if (change.approval) {
        messageParts.push(
          colors.green(`(Approved by ${change.approval.approvedBy?.displayName ?? '<unknown>'} ✓)`),
        );
      }

      this.log(...messageParts);
    });
  };

  this.info(`Detected ${changes.total} change${changes.total > 1 ? 's' : ''}`);
  this.log('');

  const breakingChanges = changes.nodes.filter(filterChangesByLevel(CriticalityLevel.Breaking));
  const dangerousChanges = changes.nodes.filter(filterChangesByLevel(CriticalityLevel.Dangerous));
  const safeChanges = changes.nodes.filter(filterChangesByLevel(CriticalityLevel.Safe));

  if (breakingChanges.length) {
    this.log(String(indent), `Breaking changes:`);
    writeChanges(breakingChanges);
  }

  if (dangerousChanges.length) {
    this.log(String(indent), `Dangerous changes:`);
    writeChanges(dangerousChanges);
  }

  if (safeChanges.length) {
    this.log(String(indent), `Safe changes:`);
    writeChanges(safeChanges);
  }
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
