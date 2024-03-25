import {
  OrganizationAccessScope,
  ProjectAccessScope,
  ProjectType,
  TargetAccessScope,
} from '@app/gql/graphql';
import { waitFor } from '../../../testkit/flow';
import { initSeed } from '../../../testkit/seed';

test.concurrent('freshly created organization has Get Started progress at 0%', async () => {
  const { createOrg } = await initSeed().createOwner();
  const { fetchOrganizationInfo } = await createOrg();
  const { getStarted: steps1 } = await fetchOrganizationInfo();

  expect(steps1?.creatingProject).toBe(false);
  expect(steps1?.publishingSchema).toBe(false);
  expect(steps1?.checkingSchema).toBe(false);
  expect(steps1?.invitingMembers).toBe(false);
  expect(steps1?.reportingOperations).toBe(false);
  expect(steps1?.enablingUsageBasedBreakingChanges).toBe(false);
});

test.concurrent('completing each step should result in updated Get Started progress', async () => {
  const { createOrg } = await initSeed().createOwner();
  const { inviteAndJoinMember, fetchOrganizationInfo, createProject } = await createOrg();
  const { target, project, createToken } = await createProject(ProjectType.Single);

  const { getStarted: steps } = await fetchOrganizationInfo();
  expect(steps?.creatingProject).toBe(true); // modified
  expect(steps?.publishingSchema).toBe(false);
  expect(steps?.checkingSchema).toBe(false);
  expect(steps?.invitingMembers).toBe(false);
  expect(steps?.reportingOperations).toBe(false);
  expect(steps?.enablingUsageBasedBreakingChanges).toBe(false);

  if (!target || !project) {
    throw new Error('Failed to create project');
  }

  const {
    publishSchema,
    checkSchema,
    collectLegacyOperations: collectOperations,
    toggleTargetValidation,
  } = await createToken({
    targetScopes: [
      TargetAccessScope.Read,
      TargetAccessScope.RegistryRead,
      TargetAccessScope.RegistryWrite,
      TargetAccessScope.Settings,
    ],
    projectScopes: [ProjectAccessScope.Read],
    organizationScopes: [OrganizationAccessScope.Read],
  });

  // Step: publish schema
  await publishSchema({ sdl: 'type Query { foo: String }' }).then(r => r.expectNoGraphQLErrors());
  const { getStarted: steps2 } = await fetchOrganizationInfo();
  expect(steps2?.creatingProject).toBe(true);
  expect(steps2?.publishingSchema).toBe(true); // modified
  expect(steps2?.checkingSchema).toBe(false);
  expect(steps2?.invitingMembers).toBe(false);
  expect(steps2?.reportingOperations).toBe(false);
  expect(steps2?.enablingUsageBasedBreakingChanges).toBe(false);

  // Step: checking schema
  await checkSchema('type Query { foo: String bar: String }');
  const { getStarted: steps3 } = await fetchOrganizationInfo();
  expect(steps3?.creatingProject).toBe(true);
  expect(steps3?.publishingSchema).toBe(true);
  expect(steps3?.checkingSchema).toBe(true); // modified
  expect(steps3?.invitingMembers).toBe(false);
  expect(steps3?.reportingOperations).toBe(false);
  expect(steps3?.enablingUsageBasedBreakingChanges).toBe(false);

  // Step: inviting members
  await inviteAndJoinMember();
  const { getStarted: steps4 } = await fetchOrganizationInfo();
  expect(steps4?.creatingProject).toBe(true);
  expect(steps4?.publishingSchema).toBe(true);
  expect(steps4?.checkingSchema).toBe(true);
  expect(steps4?.invitingMembers).toBe(true); // modified
  expect(steps4?.reportingOperations).toBe(false);
  expect(steps4?.enablingUsageBasedBreakingChanges).toBe(false);

  // Step: reporting operations
  await collectOperations([
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
  ]);
  await waitFor(5000);
  const { getStarted: steps5 } = await fetchOrganizationInfo();
  expect(steps5?.creatingProject).toBe(true);
  expect(steps5?.publishingSchema).toBe(true);
  expect(steps5?.checkingSchema).toBe(true);
  expect(steps5?.invitingMembers).toBe(true);
  expect(steps5?.reportingOperations).toBe(true); // modified
  expect(steps5?.enablingUsageBasedBreakingChanges).toBe(false);

  // Step: target validation
  await toggleTargetValidation(true);
  const { getStarted: steps6 } = await fetchOrganizationInfo();
  expect(steps6?.creatingProject).toBe(true);
  expect(steps6?.publishingSchema).toBe(true);
  expect(steps6?.checkingSchema).toBe(true);
  expect(steps6?.invitingMembers).toBe(true);
  expect(steps6?.reportingOperations).toBe(true);
  expect(steps6?.enablingUsageBasedBreakingChanges).toBe(true); // modified
});
