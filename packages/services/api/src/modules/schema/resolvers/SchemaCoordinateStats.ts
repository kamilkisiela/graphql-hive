import { GraphStore } from '../../graph/providers/graph-store';
import { extractSuperGraphInformation } from '../lib/federation-super-graph';
import { SchemaManager } from '../providers/schema-manager';
import { SchemaVersionHelper } from '../providers/schema-version-helper';
import type { SchemaCoordinateStatsResolvers } from './../../../__generated__/types';

export const SchemaCoordinateStats: Pick<SchemaCoordinateStatsResolvers, 'supergraphMetadata'> = {
  supergraphMetadata: async ({ target, schemaCoordinate }, _, { injector }) => {
    // Usage can arrive with no composable version: nothing published yet, or every publish failed.
    const graph = await injector.get(GraphStore).getDefaultGraphForTargetId(target);
    const latestVersion = await injector
      .get(SchemaManager)
      .getMaybeLatestValidVersionForGraph(graph);
    if (!latestVersion) {
      return null;
    }
    // @note: `SchemaVersionHelper.getSupergraphAst` is cached
    const supergraphAst = await injector.get(SchemaVersionHelper).getSupergraphAst(latestVersion);
    const supergraph = supergraphAst ? extractSuperGraphInformation(supergraphAst) : null;

    return {
      __typename: 'SupergraphMetadata',
      metadata: latestVersion.schemaMetadata?.[schemaCoordinate]?.map(m => ({
        ...m,
        __typename: 'SchemaMetadata',
      })),
      ownedByServiceNames: supergraph?.schemaCoordinateServicesMappings.get(schemaCoordinate),
    };
  },
};
