import { createConnection } from '../../shared/schema';
import { OrganizationManager } from '../organization/providers/organization-manager';
import { ProjectManager } from '../project/providers/project-manager';
import { IdTranslator } from '../shared/providers/id-translator';
import { PersistedOperationManager } from './providers/persisted-operation-manager';
import type { PersistedOperationsModule } from './__generated__/types';

export const resolvers: PersistedOperationsModule.Resolvers = {
  Query: {
    async storedOperations(_, _2, { injector }) {
      const [organization, project] = await Promise.all([
        injector.get(OrganizationManager).getOrganizationIdByToken(),
        injector.get(ProjectManager).getProjectIdByToken(),
      ]);

      return injector.get(PersistedOperationManager).getPersistedOperations({
        organization,
        project,
      });
    },
    async persistedOperation(_, { selector }, { injector }) {
      const translator = injector.get(IdTranslator);
      const [organization, project, operation] = await Promise.all([
        translator.translateOrganizationId(selector),
        translator.translateProjectId(selector),
        translator.translatePersistedOperationHash(selector),
      ]);

      return injector.get(PersistedOperationManager).getPersistedOperation({
        organization,
        project,
        operation,
      });
    },
    async persistedOperations(_, { selector }, { injector }) {
      const translator = injector.get(IdTranslator);
      const [organization, project] = await Promise.all([
        translator.translateOrganizationId(selector),
        translator.translateProjectId(selector),
      ]);

      return injector.get(PersistedOperationManager).getPersistedOperations({
        organization,
        project,
      });
    },
    async comparePersistedOperations(_, { hashes }, { injector }) {
      const [organization, project] = await Promise.all([
        injector.get(OrganizationManager).getOrganizationIdByToken(),
        injector.get(ProjectManager).getProjectIdByToken(),
      ]);

      return injector.get(PersistedOperationManager).comparePersistedOperations({
        organization,
        project,
        hashes,
      });
    },
  },
  Mutation: {
    async publishPersistedOperations(_, { input }, { injector }) {
      if (input.length === 0) {
        return {
          summary: {
            total: 0,
            unchanged: 0,
          },
          operations: [],
        };
      }

      const [organization, project] = await Promise.all([
        injector.get(OrganizationManager).getOrganizationIdByToken(),
        injector.get(ProjectManager).getProjectIdByToken(),
      ]);

      return injector
        .get(PersistedOperationManager)
        .createPersistedOperations(input, project, organization);
    },
    async deletePersistedOperation(_, { selector }, { injector }) {
      const translator = injector.get(IdTranslator);
      const [organizationId, projectId, operationId] = await Promise.all([
        translator.translateOrganizationId(selector),
        translator.translateProjectId(selector),
        translator.translatePersistedOperationHash(selector),
      ]);

      const persistedOperation = await injector
        .get(PersistedOperationManager)
        .deletePersistedOperation({
          organization: organizationId,
          project: projectId,
          operation: operationId,
        });

      return {
        selector: {
          organization: organizationId,
          project: projectId,
          operation: operationId,
        },
        deletedPersistedOperation: persistedOperation,
      };
    },
  },
  Project: {
    persistedOperations(project, _, { injector }) {
      return injector.get(PersistedOperationManager).getPersistedOperations({
        project: project.id,
        organization: project.orgId,
      });
    },
  },
  PersistedOperationConnection: createConnection(),
};
