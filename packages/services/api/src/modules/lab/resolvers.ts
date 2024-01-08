import { AuthManager } from '../auth/providers/auth-manager';
import { TargetAccessScope } from '../auth/providers/target-access';
import { SchemaManager } from '../schema/providers/schema-manager';
import { SchemaVersionHelper } from '../schema/providers/schema-version-helper';
import { IdTranslator } from '../shared/providers/id-translator';
import type { LabModule } from './__generated__/types';

export const resolvers: LabModule.Resolvers = {
  Query: {
    async lab(_, { selector }, { injector }) {
      const translator = injector.get(IdTranslator);
      const [organization, project, target] = await Promise.all([
        translator.translateOrganizationId(selector),
        translator.translateProjectId(selector),
        translator.translateTargetId(selector),
      ]);

      await injector.get(AuthManager).ensureTargetAccess({
        organization,
        project,
        target,
        scope: TargetAccessScope.REGISTRY_READ,
      });

      const schemaManager = injector.get(SchemaManager);

      const latestSchema = await schemaManager.getMaybeLatestValidVersion({
        organization,
        project,
        target,
      });

      if (!latestSchema) {
        return null;
      }

      const sdl = await injector.get(SchemaVersionHelper).getCompositeSchemaSdl(latestSchema);

      if (!sdl) {
        throw new Error('This cannot happen.');
      }

      return {
        schema: sdl,
        mocks: {},
      };
    },
  },
};
