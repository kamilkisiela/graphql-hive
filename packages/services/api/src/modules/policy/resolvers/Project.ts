import { SchemaPolicyProvider } from '../providers/schema-policy.provider';
import type { ProjectResolvers } from './../../../__generated__/types.next';

export const Project: Pick<ProjectResolvers, 'parentSchemaPolicy' | 'schemaPolicy' | '__isTypeOf'> =
  {
    schemaPolicy: async (project, _, { injector }) =>
      injector.get(SchemaPolicyProvider).getProjectPolicy({
        project: project.id,
        organization: project.orgId,
      }),
    parentSchemaPolicy: async (project, _, { injector }) =>
      injector.get(SchemaPolicyProvider).getOrganizationPolicyForProject({
        project: project.id,
        organization: project.orgId,
      }),
  };
