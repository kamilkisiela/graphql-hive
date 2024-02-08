/* eslint-disable no-process-env */
import { createHash } from 'node:crypto';
import { ProjectType } from '@app/gql/graphql';
import { createCLI, schemaCheck, schemaPublish } from '../../testkit/cli';
import { initSeed } from '../../testkit/seed';

describe.each`
  projectType               | model
  ${ProjectType.Single}     | ${'modern'}
  ${ProjectType.Stitching}  | ${'modern'}
  ${ProjectType.Federation} | ${'modern'}
  ${ProjectType.Single}     | ${'legacy'}
  ${ProjectType.Stitching}  | ${'legacy'}
  ${ProjectType.Federation} | ${'legacy'}
`('$projectType ($model)', ({ projectType, model }) => {
  const serviceNameArgs = projectType === ProjectType.Single ? [] : ['--service', 'test'];
  const serviceUrlArgs =
    projectType === ProjectType.Single ? [] : ['--url', 'http://localhost:4000'];
  const serviceName = projectType === ProjectType.Single ? undefined : 'test';
  const serviceUrl = projectType === ProjectType.Single ? undefined : 'http://localhost:4000';

  test.concurrent('can publish and check a schema with target:registry:read access', async () => {
    const { createOrg } = await initSeed().createOwner();
    const { inviteAndJoinMember, createProject } = await createOrg();
    await inviteAndJoinMember();
    const { createToken } = await createProject(projectType, {
      useLegacyRegistryModels: model === 'legacy',
    });
    const { secret } = await createToken({});

    await schemaPublish([
      '--registry.accessToken',
      secret,
      '--author',
      'Kamil',
      '--commit',
      'abc123',
      ...serviceNameArgs,
      ...serviceUrlArgs,
      'fixtures/init-schema.graphql',
    ]);

    await schemaCheck([
      '--service',
      'test',
      '--registry.accessToken',
      secret,
      'fixtures/nonbreaking-schema.graphql',
    ]);

    await expect(
      schemaCheck([
        ...serviceNameArgs,
        '--registry.accessToken',
        secret,
        'fixtures/breaking-schema.graphql',
      ]),
    ).rejects.toThrowError(/breaking/i);
  });

  test.concurrent(
    'publishing invalid schema SDL provides meaningful feedback for the user.',
    async () => {
      const { createOrg } = await initSeed().createOwner();
      const { inviteAndJoinMember, createProject } = await createOrg();
      await inviteAndJoinMember();
      const { createToken } = await createProject(projectType, {
        useLegacyRegistryModels: model === 'legacy',
      });
      const { secret } = await createToken({});

      const allocatedError = new Error('Should have thrown.');
      try {
        await schemaPublish([
          '--registry.accessToken',
          secret,
          '--author',
          'Kamil',
          '--commit',
          'abc123',
          ...serviceNameArgs,
          ...serviceUrlArgs,
          'fixtures/init-invalid-schema.graphql',
        ]);
        throw allocatedError;
      } catch (err) {
        if (err === allocatedError) {
          throw err;
        }
        expect(String(err)).toMatch(`The SDL is not valid at line 1, column 1:`);
        expect(String(err)).toMatch(`Syntax Error: Unexpected Name "iliketurtles"`);
      }
    },
  );

  test.concurrent('schema:publish should print a link to the website', async () => {
    const { createOrg } = await initSeed().createOwner();
    const { organization, inviteAndJoinMember, createProject } = await createOrg();
    await inviteAndJoinMember();
    const { project, target, createToken } = await createProject(projectType, {
      useLegacyRegistryModels: model === 'legacy',
    });
    const { secret } = await createToken({});

    await expect(
      schemaPublish([
        ...serviceNameArgs,
        ...serviceUrlArgs,
        '--registry.accessToken',
        secret,
        'fixtures/init-schema.graphql',
      ]),
    ).resolves.toMatch(
      `Available at ${process.env.HIVE_APP_BASE_URL}/${organization.cleanId}/${project.cleanId}/${target.cleanId}`,
    );

    await expect(
      schemaPublish([
        ...serviceNameArgs,
        ...serviceUrlArgs,
        '--registry.accessToken',
        secret,
        'fixtures/nonbreaking-schema.graphql',
      ]),
    ).resolves.toMatch(
      `Available at ${process.env.HIVE_APP_BASE_URL}/${organization.cleanId}/${project.cleanId}/${target.cleanId}/history/`,
    );
  });

  test.concurrent('schema:check should notify user when registry is empty', async () => {
    const { createOrg } = await initSeed().createOwner();
    const { inviteAndJoinMember, createProject } = await createOrg();
    await inviteAndJoinMember();
    const { createToken } = await createProject(projectType, {
      useLegacyRegistryModels: model === 'legacy',
    });
    const { secret } = await createToken({});

    await expect(
      schemaCheck([
        '--registry.accessToken',
        secret,
        ...serviceNameArgs,
        'fixtures/init-schema.graphql',
      ]),
    ).resolves.toMatch('empty');
  });

  test.concurrent('schema:check should throw on corrupted schema', async () => {
    const { createOrg } = await initSeed().createOwner();
    const { inviteAndJoinMember, createProject } = await createOrg();
    await inviteAndJoinMember();
    const { createToken } = await createProject(projectType, {
      useLegacyRegistryModels: model === 'legacy',
    });
    const { secret } = await createToken({});

    const output = schemaCheck([
      ...serviceNameArgs,
      '--registry.accessToken',
      secret,
      'fixtures/missing-type.graphql',
    ]);
    await expect(output).rejects.toThrowError('Unknown type');
  });

  test.concurrent(
    'schema:publish should see Invalid Token error when token is invalid',
    async () => {
      const invalidToken = createHash('md5').update('nope').digest('hex').substring(0, 31);
      const output = schemaPublish([
        ...serviceNameArgs,
        ...serviceUrlArgs,
        '--registry.accessToken',
        invalidToken,
        'fixtures/init-schema.graphql',
      ]);

      await expect(output).rejects.toThrowError('Invalid token provided');
    },
  );

  test
    .skipIf(projectType === ProjectType.Single)
    .concurrent('can update the service url and show it in comparison query', async () => {
      const { createOrg } = await initSeed().createOwner();
      const { inviteAndJoinMember, createProject } = await createOrg();
      await inviteAndJoinMember();
      const { createToken } = await createProject(projectType, {
        useLegacyRegistryModels: model === 'legacy',
      });
      const { secret, fetchVersions, compareToPreviousVersion } = await createToken({});
      const cli = createCLI({
        readonly: secret,
        readwrite: secret,
      });

      const sdl = /* GraphQL */ `
        type Query {
          users: [User!]
        }

        type User {
          id: ID!
          name: String!
          email: String!
        }
      `;

      await expect(
        cli.publish({
          sdl,
          commit: 'push1',
          serviceName,
          serviceUrl,
          expect: 'latest-composable',
        }),
      ).resolves.toMatch(/published/i);

      const newServiceUrl = serviceUrl + '/new';
      await expect(
        cli.publish({
          sdl,
          commit: 'push2',
          serviceName,
          serviceUrl: newServiceUrl,
          expect: 'latest-composable',
        }),
      ).resolves.toMatch(/New service url/i);

      const versions = await fetchVersions(3);
      expect(versions).toHaveLength(2);

      const versionWithNewServiceUrl = versions[0];

      expect(await compareToPreviousVersion(versionWithNewServiceUrl.id)).toEqual(
        expect.objectContaining({
          target: expect.objectContaining({
            schemaVersion: expect.objectContaining({
              safeSchemaChanges: expect.objectContaining({
                nodes: expect.arrayContaining([
                  expect.objectContaining({
                    criticality: 'Dangerous',
                    message: `[${serviceName}] New service url: '${newServiceUrl}' (previously: '${serviceUrl}')`,
                  }),
                ]),
              }),
            }),
          }),
        }),
      );
    });
});
