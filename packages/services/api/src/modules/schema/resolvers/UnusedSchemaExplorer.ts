import { buildGraphQLTypesFromSDL } from '../utils';
import type { UnusedSchemaExplorerResolvers } from './../../../__generated__/types.next';

export const UnusedSchemaExplorer: UnusedSchemaExplorerResolvers = {
  types: ({ sdl, supergraph, usage }) => {
    const unused = () =>
      ({
        isUsed: false,
        usedCoordinates: usage.usedCoordinates,
        period: usage.period,
        organization: usage.organization,
        project: usage.project,
        target: usage.target,
      }) as const;

    return buildGraphQLTypesFromSDL(sdl, unused, supergraph).sort((a, b) =>
      a.entity.name.localeCompare(b.entity.name),
    );
  },
};
