import { AuthManager } from '../auth/providers/auth-manager';
import { TargetAccessScope } from '../auth/providers/target-access';
import { OrganizationManager } from '../organization/providers/organization-manager';
import { ProjectManager } from '../project/providers/project-manager';
import { ensureSDL, SchemaHelper } from '../schema/providers/schema-helper';
import { SchemaManager } from '../schema/providers/schema-manager';
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

      if (latestSchema.compositeSchemaSDL) {
        return {
          schema: latestSchema.compositeSchemaSDL,
          mocks: {},
        };
      }

      // Legacy Fallback

      const [
        schemas,
        { type, externalComposition, nativeFederation, legacyRegistryModel },
        { featureFlags },
      ] = await Promise.all([
        schemaManager.getSchemasOfVersion({
          organization,
          project,
          target,
          version: latestSchema.id,
        }),
        injector.get(ProjectManager).getProject({
          organization,
          project,
        }),
        injector.get(OrganizationManager).getOrganization({
          organization,
        }),
      ]);

      const orchestrator = schemaManager.matchOrchestrator(type);
      const helper = injector.get(SchemaHelper);

      // TODO: should we use compositeSchemaSDL here, instead of calling orchestrator.composeAndValidate?

      const schema = await ensureSDL(
        orchestrator.composeAndValidate(
          schemas.map(s => helper.createSchemaObject(s)),
          {
            external: externalComposition,
            native: schemaManager.checkProjectNativeFederationSupport({
              project: {
                id: project,
                nativeFederation,
                legacyRegistryModel,
              },
              organization: {
                id: organization,
                featureFlags,
              },
            }),
          },
        ),
      );

      return {
        schema: schema.raw,
        mocks: {},
      };
    },
  },
};
