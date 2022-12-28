import { TargetAccessScope, ProjectType } from '@app/gql/graphql';
import { initSeed } from '../../../testkit/seed';

test.concurrent(
  'marking only the most recent version as valid result in an update of CDN',
  async () => {
    const { createOrg } = await initSeed().createOwner();
    const { createProject } = await createOrg();
    const { createToken } = await createProject(ProjectType.Single);
    const readWriteToken = await createToken({
      targetScopes: [TargetAccessScope.RegistryRead, TargetAccessScope.RegistryWrite],
      projectScopes: [],
      organizationScopes: [],
    });

    // Initial schema
    const publishResult = await readWriteToken
      .publishSchema({
        author: 'Kamil',
        commit: 'c0',
        sdl: `type Query { ping: String }`,
      })
      .then(r => r.expectNoGraphQLErrors());

    expect(publishResult.schemaPublish.__typename).toBe('SchemaPublishSuccess');

    // the initial version should available on CDN
    let cdnResult = await readWriteToken.fetchSchemaFromCDN();
    expect(cdnResult.body).toContain('ping');

    // Force a re-upload of the schema to CDN
    const syncResult = await readWriteToken.schemaSyncCDN();
    expect(syncResult.schemaSyncCDN.__typename).toBe('SchemaSyncCDNSuccess');

    // the initial version should available on CDN
    cdnResult = await readWriteToken.fetchSchemaFromCDN();
    expect(cdnResult.body).toContain('ping');
  },
);
