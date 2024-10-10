import { OperationsManager } from '../../operations/providers/operations-manager';
import { buildGraphQLTypesFromSDL, withUsedByClients } from '../utils';
import type { DeprecatedSchemaExplorerResolvers } from './../../../__generated__/types.next';

export const DeprecatedSchemaExplorer: DeprecatedSchemaExplorerResolvers = {
  types: ({ sdl, supergraph, usage }, _, { injector }) => {
    const operationsManager = injector.get(OperationsManager);

    async function getStats(typename: string) {
      const stats = await operationsManager.countCoordinatesOfTarget({
        target: usage.target,
        organization: usage.organization,
        project: usage.project,
        period: usage.period,
      });

      return withUsedByClients(stats, {
        selector: usage,
        period: usage.period,
        operationsManager,
        typename,
      });
    }

    return buildGraphQLTypesFromSDL(sdl, getStats, supergraph).sort((a, b) =>
      a.entity.name.localeCompare(b.entity.name),
    );
  },
};
