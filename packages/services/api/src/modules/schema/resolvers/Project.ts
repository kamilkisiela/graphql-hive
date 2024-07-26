import { parseDateRangeInput } from '../../../shared/helpers';
import { SchemaManager } from '../providers/schema-manager';
import type { ProjectResolvers } from './../../../__generated__/types.next';

export const Project: Pick<
  ProjectResolvers,
  | 'externalSchemaComposition'
  | 'isNativeFederationEnabled'
  | 'nativeFederationCompatibility'
  | 'registryModel'
  | 'schemaVersionsCount'
> = {
  externalSchemaComposition: project => {
    if (project.externalComposition.enabled && project.externalComposition.endpoint) {
      return {
        endpoint: project.externalComposition.endpoint,
      };
    }

    return null;
  },
  registryModel: project => {
    return project.legacyRegistryModel ? 'LEGACY' : 'MODERN';
  },
  schemaVersionsCount: (project, { period }, { injector }) => {
    return injector.get(SchemaManager).countSchemaVersionsOfProject({
      organization: project.orgId,
      project: project.id,
      period: period ? parseDateRangeInput(period) : null,
    });
  },
  isNativeFederationEnabled: project => {
    return project.nativeFederation === true;
  },
  nativeFederationCompatibility: (project, _, { injector }) => {
    return injector.get(SchemaManager).getNativeFederationCompatibilityStatus(project);
  },
};
