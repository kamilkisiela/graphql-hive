import {
  OrganizationAccessScope,
  ProjectAccessScope,
  ProjectType,
  TargetAccessScope,
} from '@app/gql/graphql';
import * as emails from '../../../testkit/emails';
import { updateOrgRateLimit, waitFor } from '../../../testkit/flow';
import { initSeed } from '../../../testkit/seed';

function filterEmailsByOrg(orgName: string, emails: emails.Email[]) {
  return emails
    .filter(email => email.subject.includes(orgName))
    .map(email => ({
      subject: email.subject,
      email: email.to,
    }));
}

test('rate limit approaching and reached for organization', async () => {
  const { createOrg, ownerToken, ownerEmail } = await initSeed().createOwner();
  const { createProject, organization } = await createOrg();
  const { createToken } = await createProject(ProjectType.Single);

  await updateOrgRateLimit(
    {
      organization: organization.cleanId,
    },
    {
      operations: 11,
    },
    ownerToken,
  );

  const { collectLegacyOperations: collectOperations } = await createToken({
    targetScopes: [
      TargetAccessScope.Read,
      TargetAccessScope.RegistryRead,
      TargetAccessScope.RegistryWrite,
    ],
    projectScopes: [ProjectAccessScope.Read],
    organizationScopes: [OrganizationAccessScope.Read],
  });

  const op = {
    operation: 'query ping { ping }',
    operationName: 'ping',
    fields: ['Query', 'Query.ping'],
    execution: {
      ok: true,
      duration: 200_000_000,
      errorsTotal: 0,
    },
  };

  // Collect operations and check for warning
  const collectResult = await collectOperations(new Array(10).fill(op));
  expect(collectResult.status).toEqual(200);

  await waitFor(5000);

  let sent = await emails.history();
  expect(sent).toContainEqual({
    to: ownerEmail,
    subject: `${organization.name} is approaching its rate limit`,
    body: expect.any(String),
  });
  expect(filterEmailsByOrg(organization.name, sent)).toHaveLength(1);

  // Collect operations and check for rate-limit reached
  const collectMoreResult = await collectOperations([op, op]);
  expect(collectMoreResult.status).toEqual(200);

  await waitFor(7000);

  sent = await emails.history();

  expect(sent).toContainEqual({
    to: ownerEmail,
    subject: `GraphQL-Hive operations quota for ${organization.name} exceeded`,
    body: expect.any(String),
  });
  expect(filterEmailsByOrg(organization.name, sent)).toHaveLength(2);

  // Make sure we don't send the same email again
  const collectEvenMoreResult = await collectOperations([op, op]);
  expect(collectEvenMoreResult.status).toEqual(200);

  await waitFor(5000);

  // Nothing new
  sent = await emails.history();
  expect(filterEmailsByOrg(organization.name, sent)).toHaveLength(2);
});
