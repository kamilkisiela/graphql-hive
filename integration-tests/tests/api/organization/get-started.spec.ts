import {
  createOrganization,
  getOrganization,
  createProject,
  createToken,
  publishSchema,
  checkSchema,
  joinOrganization,
  inviteToOrganization,
  waitFor,
  setTargetValidation,
} from '../../../testkit/flow';
import { authenticate } from '../../../testkit/auth';
import { collect } from '../../../testkit/usage';
import { TargetAccessScope, ProjectType, ProjectAccessScope, OrganizationAccessScope } from '@app/gql/graphql';

async function getSteps({ organization, token }: { organization: string; token: string }) {
  const result = await getOrganization(organization, token);

  expect(result.body.errors).not.toBeDefined();

  return result.body.data?.organization?.organization.getStarted;
}

test('freshly created organization has Get Started progress at 0%', async () => {
  const { access_token } = await authenticate('main');
  const orgResult = await createOrganization(
    {
      name: 'foo',
    },
    access_token
  );
  const org = orgResult.body.data!.createOrganization.ok!.createdOrganizationPayload.organization;

  const steps = await getSteps({
    organization: org.cleanId,
    token: access_token,
  });

  expect(steps?.creatingProject).toBe(false);
  expect(steps?.publishingSchema).toBe(false);
  expect(steps?.checkingSchema).toBe(false);
  expect(steps?.invitingMembers).toBe(false);
  expect(steps?.reportingOperations).toBe(false);
  expect(steps?.enablingUsageBasedBreakingChanges).toBe(false);
});

test('completing each step should result in updated Get Started progress', async () => {
  const { access_token } = await authenticate('main');
  const orgResult = await createOrganization(
    {
      name: 'foo',
    },
    access_token
  );
  const org = orgResult.body.data!.createOrganization.ok!.createdOrganizationPayload.organization;

  // Step: creating project

  const projectResult = await createProject(
    {
      organization: org.cleanId,
      name: 'foo',
      type: ProjectType.Single,
    },
    access_token
  );

  let steps = await getSteps({
    organization: org.cleanId,
    token: access_token,
  });

  expect(steps?.creatingProject).toBe(true); // modified
  expect(steps?.publishingSchema).toBe(false);
  expect(steps?.checkingSchema).toBe(false);
  expect(steps?.invitingMembers).toBe(false);
  expect(steps?.reportingOperations).toBe(false);
  expect(steps?.enablingUsageBasedBreakingChanges).toBe(false);

  expect(projectResult.body.errors).not.toBeDefined();

  const target = projectResult.body.data?.createProject.ok?.createdTargets.find(t => t.name === 'production');
  const project = projectResult.body.data?.createProject.ok?.createdProject;

  if (!target || !project) {
    throw new Error('Failed to create project');
  }

  const tokenResult = await createToken(
    {
      name: 'test',
      organization: org.cleanId,
      project: project.cleanId,
      target: target.cleanId,
      organizationScopes: [OrganizationAccessScope.Read],
      projectScopes: [ProjectAccessScope.Read],
      targetScopes: [
        TargetAccessScope.Read,
        TargetAccessScope.RegistryRead,
        TargetAccessScope.RegistryWrite,
        TargetAccessScope.Settings,
      ],
    },
    access_token
  );

  expect(tokenResult.body.errors).not.toBeDefined();

  const token = tokenResult.body.data!.createToken.ok!.secret;

  // Step: publishing schema

  await publishSchema(
    {
      author: 'test',
      commit: 'test',
      sdl: 'type Query { foo: String }',
    },
    token
  );

  steps = await getSteps({
    organization: org.cleanId,
    token: access_token,
  });

  expect(steps?.creatingProject).toBe(true);
  expect(steps?.publishingSchema).toBe(true); // modified
  expect(steps?.checkingSchema).toBe(false);
  expect(steps?.invitingMembers).toBe(false);
  expect(steps?.reportingOperations).toBe(false);
  expect(steps?.enablingUsageBasedBreakingChanges).toBe(false);

  // Step: checking schema

  await checkSchema(
    {
      sdl: 'type Query { foo: String bar: String }',
    },
    token
  );

  steps = await getSteps({
    organization: org.cleanId,
    token: access_token,
  });

  expect(steps?.creatingProject).toBe(true);
  expect(steps?.publishingSchema).toBe(true);
  expect(steps?.checkingSchema).toBe(true); // modified
  expect(steps?.invitingMembers).toBe(false);
  expect(steps?.reportingOperations).toBe(false);
  expect(steps?.enablingUsageBasedBreakingChanges).toBe(false);

  // Step: inviting members

  const invitationResult = await inviteToOrganization(
    {
      email: 'some@email.com',
      organization: org.cleanId,
    },
    access_token
  );

  const inviteCode = invitationResult.body.data?.inviteToOrganizationByEmail.ok?.code;
  expect(inviteCode).toBeDefined();

  const { access_token: member_access_token } = await authenticate('extra');
  await joinOrganization(inviteCode!, member_access_token);

  steps = await getSteps({
    organization: org.cleanId,
    token: access_token,
  });

  expect(steps?.creatingProject).toBe(true);
  expect(steps?.publishingSchema).toBe(true);
  expect(steps?.checkingSchema).toBe(true);
  expect(steps?.invitingMembers).toBe(true); // modified
  expect(steps?.reportingOperations).toBe(false);
  expect(steps?.enablingUsageBasedBreakingChanges).toBe(false);

  // Step: reporting operations

  await collect({
    operations: [
      {
        operationName: 'foo',
        operation: 'query foo { foo }',
        fields: ['Query', 'Query.foo'],
        execution: {
          duration: 2_000_000,
          ok: true,
          errorsTotal: 0,
        },
      },
    ],
    token,
    authorizationHeader: 'authorization',
  });
  await waitFor(5_000);

  steps = await getSteps({
    organization: org.cleanId,
    token: access_token,
  });

  expect(steps?.creatingProject).toBe(true);
  expect(steps?.publishingSchema).toBe(true);
  expect(steps?.checkingSchema).toBe(true);
  expect(steps?.invitingMembers).toBe(true);
  expect(steps?.reportingOperations).toBe(true); // modified
  expect(steps?.enablingUsageBasedBreakingChanges).toBe(false);

  // Step: reporting operations

  await setTargetValidation(
    {
      enabled: true,
      target: target.cleanId,
      project: project.cleanId,
      organization: org.cleanId,
    },
    {
      token,
    }
  );

  steps = await getSteps({
    organization: org.cleanId,
    token: access_token,
  });

  expect(steps?.creatingProject).toBe(true);
  expect(steps?.publishingSchema).toBe(true);
  expect(steps?.checkingSchema).toBe(true);
  expect(steps?.invitingMembers).toBe(true);
  expect(steps?.reportingOperations).toBe(true);
  expect(steps?.enablingUsageBasedBreakingChanges).toBe(true); // modified
});
