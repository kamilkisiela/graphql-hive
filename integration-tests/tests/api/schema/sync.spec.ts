import { TargetAccessScope, ProjectType } from '@app/gql/graphql';
import {
  createOrganization,
  joinOrganization,
  publishSchema,
  createProject,
  createToken,
  fetchSchemaFromCDN,
  schemaSyncCDN,
} from '../../../testkit/flow';
import { authenticate } from '../../../testkit/auth';

test('marking only the most recent version as valid result in an update of CDN', async () => {
  const { access_token: owner_access_token } = await authenticate('main');
  const orgResult = await createOrganization(
    {
      name: 'foo',
    },
    owner_access_token
  );

  // Join
  const { access_token: member_access_token } = await authenticate('extra');
  const org = orgResult.body.data!.createOrganization.ok!.createdOrganizationPayload.organization;
  const code = org.inviteCode;
  await joinOrganization(code, member_access_token);

  const projectResult = await createProject(
    {
      organization: org.cleanId,
      type: ProjectType.Single,
      name: 'foo',
    },
    owner_access_token
  );

  const project = projectResult.body.data!.createProject.ok!.createdProject;
  const target = projectResult.body.data!.createProject.ok!.createdTargets[0];

  const tokenResult = await createToken(
    {
      name: 'test',
      organization: org.cleanId,
      project: project.cleanId,
      target: target.cleanId,
      organizationScopes: [],
      projectScopes: [],
      targetScopes: [TargetAccessScope.RegistryRead, TargetAccessScope.RegistryWrite],
    },
    owner_access_token
  );

  expect(tokenResult.body.errors).not.toBeDefined();

  const token = tokenResult.body.data!.createToken.ok!.secret;

  // Initial schema
  const publishResult = await publishSchema(
    {
      author: 'Kamil',
      commit: 'c0',
      sdl: `type Query { ping: String }`,
    },
    token
  );

  expect(publishResult.body.errors).not.toBeDefined();
  expect(publishResult.body.data!.schemaPublish.__typename).toBe('SchemaPublishSuccess');

  const targetSelector = {
    organization: org.cleanId,
    project: project.cleanId,
    target: target.cleanId,
  };

  // the initial version should available on CDN
  let cdnResult = await fetchSchemaFromCDN(targetSelector, token);
  expect(cdnResult.body.sdl).toContain('ping');

  // Force a re-upload of the schema to CDN
  const syncResult = await schemaSyncCDN(
    {
      organization: org.cleanId,
      project: project.cleanId,
      target: target.cleanId,
    },
    token
  );

  expect(syncResult.body.errors).not.toBeDefined();
  expect(syncResult.body.data!.schemaSyncCDN.__typename).toBe('SchemaSyncCDNSuccess');

  // the initial version should available on CDN
  cdnResult = await fetchSchemaFromCDN(targetSelector, token);
  expect(cdnResult.body.sdl).toContain('ping');
});
