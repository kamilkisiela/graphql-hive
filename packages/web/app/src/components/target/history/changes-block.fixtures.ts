import { makeFragmentData } from '@/gql';
import { SeverityLevelType } from '@/gql/graphql';
import {
  ChangesBlock_SchemaChangeWithUsageFragment,
  ChangesBlock_SchemaCheckConditionalBreakingChangeMetadataFragment,
} from './errors-and-changes';

/** Breaking changes with per-target usage, shared by the ChangesBlock and paging previews. */

export const PATH = '/the-guild/graphql-hive/staging';
const PERIOD = { from: '2026-10-01T10:00:00.000Z', to: '2026-10-08T10:00:00.000Z' };

export type PreviewTarget = {
  id: string;
  slug: string;
  target: { id: string; slug: string } | null;
};

const TARGET_SLUGS = [
  'production-eu',
  'production-us',
  'staging',
  'app-web',
  'app-ios',
  'app-android',
  'partner-api',
  'internal-tools',
  'sandbox',
  'canary',
  'legacy',
];

const TARGETS: PreviewTarget[] = TARGET_SLUGS.map((slug, index) => ({
  id: `target-${index + 1}`,
  slug,
  target: { id: `target-${index + 1}`, slug },
}));

const CLIENTS = [{ name: 'webapp', countFormatted: '255.2M', percentageFormatted: '44.06%' }];

const CHANGES = [
  { type: 'FunnelMetrics_ClosedWon', operation: 'FunnelMetricsClosedWon', hash: 'a0ec' },
  { type: 'FunnelMetrics_Created', operation: 'FunnelMetricsCreated', hash: 'bdd1' },
  { type: 'ProspectsContacted', operation: 'ProspectsContacted', hash: 'fb2a' },
  { type: 'ProspectsContactedActivity', operation: 'ProspectsContactedActivity', hash: '49ce' },
];

const hashOf = (prefix: string, index: number) => `${prefix}${index}`.padEnd(40, prefix);

export const metadata = (targets: PreviewTarget[]) =>
  makeFragmentData(
    {
      __typename: 'SchemaCheckConditionalBreakingChangeMetadata' as const,
      period: { __typename: 'DateRange' as const, ...PERIOD },
      settings: {
        __typename: 'SchemaCheckConditionalBreakingChangeMetadataSettings' as const,
        retentionInDays: 7,
        targets: targets.map(target => ({
          __typename: 'BreakingChangeMetadataTarget' as const,
          id: target.id,
          slug: target.slug,
          target: target.target ? { __typename: 'Target' as const, ...target.target } : null,
        })),
      },
    },
    ChangesBlock_SchemaCheckConditionalBreakingChangeMetadataFragment,
  );

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const targetUsage = (target: PreviewTarget, count: number) => ({
  __typename: 'SchemaChangeUsageStatisticsAffectedTarget' as const,
  target: {
    __typename: 'BreakingChangeMetadataTarget' as const,
    id: target.id,
    slug: target.slug,
    target: target.target ? { __typename: 'Target' as const, ...target.target } : null,
  },
  count,
  countFormatted: String(count),
});

// Later operations reach fewer targets, so their "Seen in" differs from the change's.
export function buildChanges(args: {
  usedTargets: number;
  unusedTargets: number;
  operations: number;
  legacy: boolean;
}) {
  const usedCount = clamp(args.usedTargets, 1, 3);
  const targets = TARGETS.slice(
    0,
    usedCount + clamp(args.unusedTargets, 0, TARGETS.length - usedCount),
  );
  const used = targets.slice(0, usedCount);
  const spread = (index: number) =>
    index === 0 ? used : index === 1 ? used.slice(0, 1) : used.slice(-1);

  const changes = CHANGES.map(change => {
    const operations = Array.from({ length: clamp(args.operations, 1, 3) }, (_, index) => ({
      targets: spread(index),
      name: index === 0 ? change.operation : `${change.operation}${index + 1}`,
      hash: hashOf(change.hash, index),
    }));
    const countFor = (target: PreviewTarget) =>
      operations.filter(operation => operation.targets.includes(target)).length;
    const total = operations.reduce((sum, operation) => sum + operation.targets.length, 0);

    return makeFragmentData(
      {
        __typename: 'SchemaChange' as const,
        path: [change.type],
        message: `Type '${change.type}' was removed`,
        severityLevel: SeverityLevelType.Breaking,
        severityReason:
          'Removing a type is a breaking change. It is preferable to deprecate and remove all references to this type first.',
        isSafeBasedOnUsage: false,
        approval: null,
        usageStatistics: {
          __typename: 'SchemaChangeUsageStatistics' as const,
          topAffectedOperations: operations.map(operation => ({
            __typename: 'SchemaChangeUsageStatisticsAffectedOperation' as const,
            hash: operation.hash,
            name: operation.name,
            countFormatted: String(operation.targets.length),
            percentageFormatted: '<0.01%',
            affectedTargets: args.legacy
              ? null
              : operation.targets.map(target => ({
                  __typename: 'SchemaChangeUsageStatisticsAffectedTarget' as const,
                  target: {
                    __typename: 'BreakingChangeMetadataTarget' as const,
                    id: target.id,
                    slug: target.slug,
                  },
                })),
          })),
          topAffectedClients: CLIENTS.map(client => ({
            __typename: 'SchemaChangeUsageStatisticsAffectedClient' as const,
            ...client,
            countFormatted: args.legacy ? client.countFormatted : String(total),
          })),
          affectedTargets: args.legacy
            ? null
            : used.map(target => ({
                ...targetUsage(target, countFor(target)),
                operationCount: countFor(target),
              })),
          schemaCoordinate: args.legacy ? null : change.type,
        },
        affectedAppDeployments: null,
      },
      ChangesBlock_SchemaChangeWithUsageFragment,
    );
  });

  return { targets, changes };
}
