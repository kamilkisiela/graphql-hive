import type { DateRange } from '../../shared/entities';
import type { PromiseOrValue } from '../../shared/helpers';
import { OperationsManager } from '../operations/providers/operations-manager';
import { TargetSelector } from '../shared/providers/storage';

export function withUsedByClients<
  T extends {
    isUsed: boolean;
  },
>(
  input: Record<string, T>,
  deps: {
    operationsManager: OperationsManager;
    selector: TargetSelector;
    period: DateRange;
    typename: string;
  },
): Record<
  string,
  T & {
    usedByClients: () => PromiseOrValue<Array<string>>;
    period: DateRange;
    organization: string;
    project: string;
    target: string;
    typename: string;
  }
> {
  return Object.fromEntries(
    Object.entries(input).map(([schemaCoordinate, record]) => [
      schemaCoordinate,
      {
        selector: deps.selector,
        period: deps.period,
        typename: deps.typename,
        organization: deps.selector.organization,
        project: deps.selector.project,
        target: deps.selector.target,
        ...record,
        usedByClients() {
          if (record.isUsed === false) {
            return [];
          }

          // It's using DataLoader under the hood so it's safe to call it multiple times for different coordinates
          return deps.operationsManager.getClientNamesPerCoordinateOfType({
            ...deps.selector,
            period: deps.period,
            typename: deps.typename,
            schemaCoordinate,
          });
        },
      },
    ]),
  );
}
