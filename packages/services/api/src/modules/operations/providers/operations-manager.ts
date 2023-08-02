import DataLoader from 'dataloader';
import { Injectable, Scope } from 'graphql-modules';
import LRU from 'lru-cache';
import type { DateRange } from '../../../shared/entities';
import type { Listify, Optional } from '../../../shared/helpers';
import { cache } from '../../../shared/helpers';
import { AuthManager } from '../../auth/providers/auth-manager';
import { TargetAccessScope } from '../../auth/providers/target-access';
import { Logger } from '../../shared/providers/logger';
import type {
  OrganizationSelector,
  ProjectSelector,
  TargetSelector,
} from '../../shared/providers/storage';
import { Storage } from '../../shared/providers/storage';
import { OperationsReader } from './operations-reader';

const DAY_IN_MS = 86_400_000;
const lru = new LRU<string, boolean>({
  max: 500,
  ttl: 30 * DAY_IN_MS,
  stale: false,
});

async function hasCollectedOperationsCached(target: string, checkFn: () => Promise<boolean>) {
  if (lru.get(target)) {
    return true;
  }

  const collected = await checkFn();

  if (collected) {
    lru.set(target, true);
  }

  return collected;
}

interface ReadFieldStatsInput extends TargetSelector {
  type: string;
  field: string;
  argument?: string;
  period: DateRange;
}

interface ReadFieldStatsOutput {
  type: string;
  field: string;
  argument?: string;
  period: DateRange;
  count: number;
  percentage: number;
}

/**
 * Responsible for auth checks.
 * Talks to Storage.
 */
@Injectable({
  scope: Scope.Operation,
  global: true,
})
export class OperationsManager {
  private logger: Logger;
  private requestsOverTimeOfTargetsLoader: DataLoader<
    {
      targets: readonly string[];
      period: DateRange;
      resolution: number;
    },
    {
      [target: string]: {
        date: any;
        value: number;
      }[];
    },
    string
  >;

  constructor(
    logger: Logger,
    private authManager: AuthManager,
    private reader: OperationsReader,
    private storage: Storage,
  ) {
    this.logger = logger.child({ source: 'OperationsManager' });

    this.requestsOverTimeOfTargetsLoader = new DataLoader(
      async selectors => {
        const results = await this.reader.requestsOverTimeOfTargets(selectors);

        return results;
      },
      {
        cacheKeyFn(selector) {
          return `${selector.period.from.toISOString()};${selector.period.to.toISOString()};${
            selector.resolution
          };${selector.targets.join(',')}}`;
        },
        batchScheduleFn: callback => setTimeout(callback, 100),
      },
    );
  }

  async getOperationBody({
    organization,
    project,
    target,
    hash,
  }: { hash: string } & TargetSelector) {
    await this.authManager.ensureTargetAccess({
      organization,
      project,
      target,
      scope: TargetAccessScope.REGISTRY_READ,
    });

    return await this.reader.readOperationBody({
      target,
      hash,
    });
  }

  async countUniqueOperations({
    organization,
    project,
    target,
    period,
    operations,
    clients,
  }: {
    period: DateRange;
    operations?: readonly string[];
    clients?: readonly string[];
  } & TargetSelector) {
    this.logger.info('Counting unique operations (period=%o, target=%s)', period, target);
    await this.authManager.ensureTargetAccess({
      organization,
      project,
      target,
      scope: TargetAccessScope.REGISTRY_READ,
    });

    return await this.reader.countUniqueDocuments({
      target,
      period,
      operations,
      clients,
    });
  }

  async hasCollectedOperations({ organization, project, target }: TargetSelector) {
    this.logger.info('Checking existence of collected operations (target=%s)', target);
    await this.authManager.ensureTargetAccess({
      organization,
      project,
      target,
      scope: TargetAccessScope.REGISTRY_READ,
    });

    return hasCollectedOperationsCached(target, () =>
      this.reader.hasCollectedOperations({
        target,
      }),
    );
  }

  async countRequests({
    organization,
    project,
    target,
    period,
    operations,
    clients,
  }: { period: DateRange; operations?: readonly string[]; clients?: readonly string[] } & Listify<
    TargetSelector,
    'target'
  >) {
    this.logger.info('Counting requests (period=%s, target=%s)', period, target);
    await this.authManager.ensureTargetAccess({
      organization,
      project,
      target,
      scope: TargetAccessScope.REGISTRY_READ,
    });

    return this.reader
      .countOperations({
        target,
        period,
        operations,
        clients,
      })
      .then(r => r.total);
  }

  async countFailures({
    organization,
    project,
    target,
    period,
    operations,
    clients,
  }: {
    period: DateRange;
    operations?: readonly string[];
    clients?: readonly string[];
  } & TargetSelector) {
    this.logger.info('Counting failures (period=%o, target=%s)', period, target);
    await this.authManager.ensureTargetAccess({
      organization,
      project,
      target,
      scope: TargetAccessScope.REGISTRY_READ,
    });

    return this.reader.countFailures({
      target,
      period,
      operations,
      clients,
    });
  }

  async readFieldStats(input: ReadFieldStatsInput): Promise<ReadFieldStatsOutput>;
  async readFieldStats(
    input: Optional<ReadFieldStatsInput, 'field'>,
  ): Promise<Optional<ReadFieldStatsOutput, 'field'>>;
  async readFieldStats(input: ReadFieldStatsInput): Promise<ReadFieldStatsOutput> {
    const { type, field, argument, period, organization, project, target } = input;
    this.logger.info('Counting a field (period=%o, target=%s)', period, target);
    await this.authManager.ensureTargetAccess({
      organization,
      project,
      target,
      scope: TargetAccessScope.REGISTRY_READ,
    });

    const [totalField, total] = await Promise.all([
      this.reader.countField({
        type,
        field,
        argument,
        target,
        period,
      }),
      this.reader.countOperations({ target, period }).then(r => r.total),
    ]);

    return {
      type,
      field,
      argument,
      period,
      count: totalField,
      percentage: total === 0 ? 0 : (totalField / total) * 100,
    };
  }

  async readFieldListStats({
    fields,
    period,
    organization,
    project,
    target,
    unsafe__itIsMeInspector,
    excludedClients,
  }: {
    fields: ReadonlyArray<{
      type: string;
      field?: string | null;
      argument?: string | null;
    }>;
    period: DateRange;
    /**
     * Skips the access check.
     * A token created for one target can't access data from the other targets.
     * This is a workaround for the inspector only.
     * TODO: let's think how to solve it well, soon.
     */
    unsafe__itIsMeInspector?: boolean;
    excludedClients?: readonly string[];
  } & Listify<TargetSelector, 'target'>) {
    this.logger.info(
      'Counting fields (period=%o, target=%s, excludedClients=%s)',
      period,
      target,
      excludedClients?.join(', ') ?? 'none',
    );

    if (!unsafe__itIsMeInspector) {
      await this.authManager.ensureTargetAccess({
        organization,
        project,
        target,
        scope: TargetAccessScope.REGISTRY_READ,
      });
    }

    const [totalFields, total] = await Promise.all([
      this.reader.countFields({
        fields,
        target,
        period,
        excludedClients,
      }),
      this.reader.countOperations({ target, period }).then(r => r.total),
    ]);

    return Object.keys(totalFields).map(id => {
      const [type, field, argument] = id.split('.');
      const totalField = totalFields[id] ?? 0;

      return {
        type,
        field,
        argument,
        period,
        count: totalField,
        percentage: total === 0 ? 0 : (totalField / total) * 100,
      };
    });
  }

  async readOperationsStats({
    period,
    organization,
    project,
    target,
    operations,
    clients,
  }: {
    period: DateRange;
    operations?: readonly string[];
    clients?: readonly string[];
  } & TargetSelector) {
    this.logger.info('Reading operations stats (period=%o, target=%s)', period, target);
    await this.authManager.ensureTargetAccess({
      organization,
      project,
      target,
      scope: TargetAccessScope.REGISTRY_READ,
    });

    // Maybe it needs less data
    return this.reader.readUniqueDocuments({
      target,
      period,
      operations,
      clients,
    });
  }

  async readRequestsOverTimeOfProject({
    period,
    resolution,
    organization,
    project,
  }: {
    period: DateRange;
    resolution: number;
  } & ProjectSelector): Promise<
    Array<{
      date: any;
      value: number;
    }>
  > {
    this.logger.debug(
      'Reading requests over time of project (period=%o, resolution=%s, project=%s)',
      period,
      resolution,
      project,
    );
    const targets = await this.storage.getTargetIdsOfProject({
      organization,
      project,
    });
    await Promise.all(
      targets.map(target =>
        this.authManager.ensureTargetAccess({
          organization,
          project,
          target,
          scope: TargetAccessScope.REGISTRY_READ,
        }),
      ),
    );

    const groups = await this.requestsOverTimeOfTargetsLoader.load({
      targets,
      period,
      resolution,
    });

    // Because we get data for each target separately, we need to sum(targets) per date
    // All dates are the same for all targets as we use `toStartOfInterval` function of clickhouse under the hood,
    // with the same interval value.
    // The `toStartOfInterval` function gives back the same output for data time points within the same interval window.
    // Let's say that interval is 10 minutes.
    // `2023-21-10 21:37` and `2023-21-10 21:38` are within 21:30 and 21:40 window, so the output will be `2023-21-10 21:30`.
    const dataPointsAggregator = new Map<number, number>();

    for (const target in groups) {
      const targetDataPoints = groups[target];

      for (const dataPoint of targetDataPoints) {
        const existing = dataPointsAggregator.get(dataPoint.date);

        if (existing == null) {
          dataPointsAggregator.set(dataPoint.date, dataPoint.value);
        } else {
          dataPointsAggregator.set(dataPoint.date, existing + dataPoint.value);
        }
      }
    }

    return Array.from(dataPointsAggregator.entries())
      .map(([date, value]) => ({ date, value }))
      .sort((a, b) => a.date - b.date);
  }

  async readRequestsOverTimeOfTargets({
    period,
    resolution,
    organization,
    project,
    targets,
  }: {
    period: DateRange;
    resolution: number;
    targets: string[];
  } & ProjectSelector) {
    this.logger.debug(
      'Reading requests over time of targets (period=%o, resolution=%s, targets=%s)',
      period,
      resolution,
      targets.join(';'),
    );
    await Promise.all(
      targets.map(target =>
        this.authManager.ensureTargetAccess({
          organization,
          project,
          target,
          scope: TargetAccessScope.REGISTRY_READ,
        }),
      ),
    );

    return this.requestsOverTimeOfTargetsLoader.load({
      targets,
      period,
      resolution,
    });
  }

  async readRequestsOverTime({
    period,
    resolution,
    organization,
    project,
    target,
    operations,
    clients,
  }: {
    period: DateRange;
    resolution: number;
    operations?: readonly string[];
    clients?: readonly string[];
  } & TargetSelector) {
    this.logger.info(
      'Reading requests over time (period=%o, resolution=%s, target=%s)',
      period,
      resolution,
      target,
    );
    await this.authManager.ensureTargetAccess({
      organization,
      project,
      target,
      scope: TargetAccessScope.REGISTRY_READ,
    });

    return this.reader.requestsOverTime({
      target,
      period,
      resolution,
      operations,
      clients,
    });
  }

  async readFailuresOverTime({
    period,
    resolution,
    organization,
    project,
    target,
    operations,
    clients,
  }: {
    period: DateRange;
    resolution: number;
    operations?: readonly string[];
    clients?: readonly string[];
  } & TargetSelector) {
    this.logger.info(
      'Reading failures over time (period=%o, resolution=%s, target=%s)',
      period,
      resolution,
      target,
    );
    await this.authManager.ensureTargetAccess({
      organization,
      project,
      target,
      scope: TargetAccessScope.REGISTRY_READ,
    });

    return this.reader.failuresOverTime({
      target,
      period,
      resolution,
      operations,
      clients,
    });
  }

  async readDurationOverTime({
    period,
    resolution,
    organization,
    project,
    target,
    operations,
    clients,
  }: {
    period: DateRange;
    resolution: number;
    operations?: readonly string[];
    clients?: readonly string[];
  } & TargetSelector) {
    this.logger.info(
      'Reading duration over time (period=%o, resolution=%s, target=%s)',
      period,
      resolution,
      target,
    );
    await this.authManager.ensureTargetAccess({
      organization,
      project,
      target,
      scope: TargetAccessScope.REGISTRY_READ,
    });

    return this.reader.durationOverTime({
      target,
      period,
      resolution,
      operations,
      clients,
    });
  }

  async readGeneralDurationPercentiles({
    period,
    organization,
    project,
    target,
    operations,
    clients,
  }: {
    period: DateRange;
    operations?: readonly string[];
    clients?: readonly string[];
  } & TargetSelector) {
    this.logger.info('Reading overall duration percentiles (period=%o, target=%s)', period, target);
    await this.authManager.ensureTargetAccess({
      organization,
      project,
      target,
      scope: TargetAccessScope.REGISTRY_READ,
    });

    return this.reader.generalDurationPercentiles({
      target,
      period,
      operations,
      clients,
    });
  }

  @cache<{ period: DateRange } & TargetSelector>(selector => JSON.stringify(selector))
  async readDetailedDurationPercentiles({
    period,
    organization,
    project,
    target,
    operations,
    clients,
  }: {
    period: DateRange;
    operations?: readonly string[];
    clients?: readonly string[];
  } & TargetSelector) {
    this.logger.info(
      'Reading detailed duration percentiles (period=%o, target=%s, clientFilter=%s)',
      period,
      target,
      clients,
    );
    await this.authManager.ensureTargetAccess({
      organization,
      project,
      target,
      scope: TargetAccessScope.REGISTRY_READ,
    });

    return this.reader.durationPercentiles({
      target,
      period,
      operations,
      clients,
    });
  }

  async readDurationHistogram({
    period,
    organization,
    project,
    target,
    operations,
    clients,
  }: {
    period: DateRange;
    operations?: readonly string[];
    clients?: readonly string[];
  } & TargetSelector) {
    this.logger.info('Reading duration histogram (period=%o, target=%s)', period, target);
    await this.authManager.ensureTargetAccess({
      organization,
      project,
      target,
      scope: TargetAccessScope.REGISTRY_READ,
    });

    return this.reader.durationHistogram({
      target,
      period,
      operations,
      clients,
    });
  }

  async readUniqueClients({
    period,
    organization,
    project,
    target,
    operations,
  }: { period: DateRange; operations?: readonly string[] } & TargetSelector) {
    this.logger.info('Counting unique clients (period=%o, target=%s)', period, target);
    await this.authManager.ensureTargetAccess({
      organization,
      project,
      target,
      scope: TargetAccessScope.REGISTRY_READ,
    });

    return this.reader.countUniqueClients({
      target,
      period,
      operations,
    });
  }

  async readUniqueClientNames({
    period,
    organization,
    project,
    target,
    operations,
  }: { period: DateRange; operations?: readonly string[] } & Listify<TargetSelector, 'target'>) {
    this.logger.info('Read unique client names (period=%o, target=%s)', period, target);
    await this.authManager.ensureTargetAccess({
      organization,
      project,
      target,
      scope: TargetAccessScope.REGISTRY_READ,
    });

    return this.reader.readUniqueClientNames({
      target,
      period,
      operations,
    });
  }

  private clientNamesPerCoordinateOfTypeDataLoaderCache = new Map<
    string,
    DataLoader<string, Map<string, Set<string>>>
  >();

  private getClientNamesPerCoordinateOfTypeLoader(args: { target: string; period: DateRange }) {
    // Stores a DataLoader per target and date range
    // A many type names can share the same DataLoader as long as they share the same target and date range.
    const cacheKey = [args.target, args.period.from, args.period.to].join('__');
    let loader = this.clientNamesPerCoordinateOfTypeDataLoaderCache.get(cacheKey);

    if (loader == null) {
      loader = new DataLoader<string, Map<string, Set<string>>>(typenames => {
        return Promise.all(
          typenames.map(typename => {
            return this.reader.getClientNamesPerCoordinateOfType({
              targetId: args.target,
              period: args.period,
              typename,
            });
          }),
        );
      });
      this.clientNamesPerCoordinateOfTypeDataLoaderCache.set(cacheKey, loader);
    }

    return loader;
  }

  /**
   * Receive a list of clients that queried a specific schema coordinate.
   * Uses DataLoader underneath for batching.
   */
  async getClientNamesPerCoordinateOfType(
    args: {
      period: DateRange;
      schemaCoordinate: string;
      typename: string;
    } & TargetSelector,
  ) {
    await this.authManager.ensureTargetAccess({
      organization: args.organization,
      project: args.project,
      target: args.target,
      scope: TargetAccessScope.REGISTRY_READ,
    });

    const loader = this.getClientNamesPerCoordinateOfTypeLoader({
      target: args.target,
      period: args.period,
    });

    const clientNamesCoordinateMap = await loader.load(args.typename);

    return Array.from(clientNamesCoordinateMap.get(args.schemaCoordinate) ?? []);
  }

  async hasOperationsForOrganization(selector: OrganizationSelector): Promise<boolean> {
    this.logger.info(
      'Checking existence of collected operations (organization=%s)',
      selector.organization,
    );
    const targets = await this.storage.getTargetIdsOfOrganization(selector);

    if (targets.length === 0) {
      return false;
    }

    const hasCollectedOperations = await this.reader.hasCollectedOperations({ target: targets });

    if (hasCollectedOperations) {
      await this.storage.completeGetStartedStep({
        organization: selector.organization,
        step: 'reportingOperations',
      });
      return true;
    }

    return false;
  }

  /**
   * Returns a collection of all schema coordinates for a given target AND type, with the number of calls to each coordinate.
   */
  @cache<
    {
      period: DateRange;
      typename: string;
    } & TargetSelector
  >(selector => JSON.stringify(selector))
  async countCoordinatesOfType({
    period,
    target,
    project,
    organization,
    typename,
  }: {
    period: DateRange;
    typename: string;
  } & TargetSelector) {
    await this.authManager.ensureTargetAccess({
      organization,
      project,
      target,
      scope: TargetAccessScope.REGISTRY_READ,
    });

    const rows = await this.reader.countCoordinatesOfType({
      target,
      period,
      typename,
    });

    const records: {
      [coordinate: string]: {
        total: number;
        isUsed: boolean;
      };
    } = {};

    for (const row of rows) {
      records[row.coordinate] = {
        total: row.total,
        isUsed: row.total > 0,
      };
    }

    return records;
  }

  /**
   * Returns a collection of all schema coordinates for a given target, with the number of calls to each coordinate.
   */
  @cache<
    {
      period: DateRange;
    } & TargetSelector
  >(selector => JSON.stringify(selector))
  async countCoordinatesOfTarget({
    period,
    target,
    project,
    organization,
  }: {
    period: DateRange;
  } & TargetSelector) {
    await this.authManager.ensureTargetAccess({
      organization,
      project,
      target,
      scope: TargetAccessScope.REGISTRY_READ,
    });

    const rows = await this.reader.countCoordinatesOfTarget({
      target,
      period,
    });

    const records: {
      [coordinate: string]: {
        total: number;
        isUsed: boolean;
      };
    } = {};

    for (const row of rows) {
      records[row.coordinate] = {
        total: row.total,
        isUsed: row.total > 0,
      };
    }

    return records;
  }
}
