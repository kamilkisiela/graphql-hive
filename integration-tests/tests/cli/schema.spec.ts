/* eslint-disable no-process-env */
import { createHash, randomUUID } from 'node:crypto';
import { writeFile } from 'node:fs/promises';
import { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parse } from 'graphql';
import { createYoga } from 'graphql-yoga';
import stripAnsi from 'strip-ansi';
import { createContract, getSchemaCheckDetails, pollFor } from 'testkit/flow';
import { ProjectType, RuleInstanceSeverityLevel } from 'testkit/gql/graphql';
import * as GraphQLSchema from 'testkit/gql/graphql';
import { buildSubgraphSchema } from '@apollo/subgraph';
import { useDisableIntrospection } from '@graphql-yoga/plugin-disable-introspection';
import type { CompositeSchema } from '@hive/api/__generated__/types';
import { createServer } from '@hive/service-common';
import {
  appCreate,
  appPublish,
  cliErrorMessage,
  createCLI,
  schemaCheck,
  schemaPublish,
} from '../../testkit/cli';
import { cliOutputSnapshotSerializer } from '../../testkit/cli-snapshot-serializer';
import { initSeed } from '../../testkit/seed';
import { createPolicy } from '../api/policy/policy-check.spec';

expect.addSnapshotSerializer(cliOutputSnapshotSerializer);

describe.each([ProjectType.Stitching, ProjectType.Federation, ProjectType.Single])(
  '%s',
  projectType => {
    const serviceNameArgs = projectType === ProjectType.Single ? [] : ['--service', 'test'];
    const serviceUrlArgs =
      projectType === ProjectType.Single ? [] : ['--url', 'http://localhost:4000'];
    const serviceName = projectType === ProjectType.Single ? undefined : 'test';
    const serviceUrl = projectType === ProjectType.Single ? undefined : 'http://localhost:4000';

    test.concurrent(
      'can publish a schema with breaking, warning and safe changes',
      async ({ expect }) => {
        const { createOrg } = await initSeed().createOwner();
        const { inviteAndJoinMember, createProject } = await createOrg();
        await inviteAndJoinMember();
        const { createTargetAccessToken } = await createProject(projectType);
        const { secret } = await createTargetAccessToken({});

        await expect(
          schemaPublish([
            '--registry.accessToken',
            secret,
            '--author',
            'Kamil',
            '--commit',
            'abc123',
            ...serviceNameArgs,
            ...serviceUrlArgs,
            'fixtures/init-schema-detailed.graphql',
          ]),
        ).resolves.toMatchSnapshot('schemaPublish');

        await expect(
          schemaCheck([
            ...serviceNameArgs,
            '--registry.accessToken',
            secret,
            'fixtures/breaking-schema-detailed.graphql',
          ]),
        ).rejects.toMatchSnapshot('schemaCheck');
      },
    );

    test.concurrent(
      'can publish and check a schema with target:registry:read access',
      async ({ expect }) => {
        const { createOrg } = await initSeed().createOwner();
        const { inviteAndJoinMember, createProject } = await createOrg();
        await inviteAndJoinMember();
        const { createTargetAccessToken } = await createProject(projectType);
        const { secret } = await createTargetAccessToken({});

        await expect(
          schemaPublish([
            '--registry.accessToken',
            secret,
            '--author',
            'Kamil',
            '--commit',
            'abc123',
            ...serviceNameArgs,
            ...serviceUrlArgs,
            'fixtures/init-schema.graphql',
          ]),
        ).resolves.toMatchSnapshot('schemaPublish');

        await expect(
          schemaCheck([
            '--service',
            'test',
            '--registry.accessToken',
            secret,
            'fixtures/nonbreaking-schema.graphql',
          ]),
        ).resolves.toMatchSnapshot('schemaCheck (non-breaking)');

        await expect(
          schemaCheck([
            ...serviceNameArgs,
            '--registry.accessToken',
            secret,
            'fixtures/breaking-schema.graphql',
          ]),
        ).rejects.toMatchSnapshot('schemaCheck (breaking)');
      },
    );

    test
      .skipIf(projectType === ProjectType.Single)
      .concurrent('publish validates the service name', async ({ expect }) => {
        const { createOrg } = await initSeed().createOwner();
        const { inviteAndJoinMember, createProject } = await createOrg();
        await inviteAndJoinMember();
        const { createTargetAccessToken } = await createProject(projectType);
        const { secret } = await createTargetAccessToken({});

        await expect(
          schemaPublish([
            '--registry.accessToken',
            secret,
            '--author',
            'Kamil',
            '--commit',
            'abc123',
            '--service',
            '900',
            ...serviceUrlArgs,
            'fixtures/init-schema.graphql',
          ]),
        ).rejects.toMatchSnapshot('onlyNumbers');

        await expect(
          schemaPublish([
            '--registry.accessToken',
            secret,
            '--author',
            'Kamil',
            '--commit',
            'abc123',
            '--service',
            'asdf$#%^#@!#',
            ...serviceUrlArgs,
            'fixtures/init-schema.graphql',
          ]),
        ).rejects.toMatchSnapshot('specialCharacters');

        await expect(
          schemaPublish([
            '--registry.accessToken',
            secret,
            '--author',
            'Kamil',
            '--commit',
            'abc123',
            '--service',
            'valid-name0',
            ...serviceUrlArgs,
            'fixtures/init-schema.graphql',
          ]),
        ).resolves.toMatchSnapshot('success');
      });

    test
      .skipIf(projectType === ProjectType.Single)
      .concurrent('check validates the service name', async ({ expect }) => {
        const { createOrg } = await initSeed().createOwner();
        const { inviteAndJoinMember, createProject } = await createOrg();
        await inviteAndJoinMember();
        const { createTargetAccessToken } = await createProject(projectType);
        const { secret } = await createTargetAccessToken({});

        await expect(
          schemaCheck([
            '--registry.accessToken',
            secret,
            '--author',
            'Kamil',
            '--commit',
            'abc123',
            '--service',
            '900',
            'fixtures/init-schema.graphql',
          ]),
        ).rejects.toMatchSnapshot('onlyNumbers');

        await expect(
          schemaCheck([
            '--registry.accessToken',
            secret,
            '--author',
            'Kamil',
            '--commit',
            'abc123',
            '--service',
            'asdf$#%^#@!#',
            'fixtures/init-schema.graphql',
          ]),
        ).rejects.toMatchSnapshot('specialCharacters');

        await expect(
          schemaCheck([
            '--registry.accessToken',
            secret,
            '--author',
            'Kamil',
            '--commit',
            'abc123',
            '--service',
            'valid-name0',
            'fixtures/init-schema.graphql',
          ]),
        ).resolves.toMatchSnapshot('success');
      });

    test.concurrent(
      'publishing invalid schema SDL provides meaningful feedback for the user.',
      async ({ expect }) => {
        const { createOrg } = await initSeed().createOwner();
        const { inviteAndJoinMember, createProject } = await createOrg();
        await inviteAndJoinMember();
        const { createTargetAccessToken } = await createProject(projectType);
        const { secret } = await createTargetAccessToken({});

        await expect(
          schemaPublish([
            '--registry.accessToken',
            secret,
            '--author',
            'Kamil',
            '--commit',
            'abc123',
            ...serviceNameArgs,
            ...serviceUrlArgs,
            'fixtures/init-invalid-schema.graphql',
          ]),
        ).rejects.toMatchSnapshot('schemaPublish');
      },
    );

    test.concurrent('schema:publish should print a link to the website', async ({ expect }) => {
      const { createOrg } = await initSeed().createOwner();
      const { organization, inviteAndJoinMember, createProject } = await createOrg();
      await inviteAndJoinMember();
      const { project, target, createTargetAccessToken } = await createProject(projectType);
      const { secret } = await createTargetAccessToken({});

      await expect(
        schemaPublish([
          ...serviceNameArgs,
          ...serviceUrlArgs,
          '--registry.accessToken',
          secret,
          'fixtures/init-schema.graphql',
        ]),
      ).resolves.toMatch(
        `Available at ${process.env.HIVE_APP_BASE_URL}/${organization.slug}/${project.slug}/${target.slug}`,
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
        `Available at ${process.env.HIVE_APP_BASE_URL}/${organization.slug}/${project.slug}/${target.slug}/history/`,
      );
    });

    test.concurrent(
      'schema:check should notify user when registry is empty',
      async ({ expect }) => {
        const { createOrg } = await initSeed().createOwner();
        const { inviteAndJoinMember, createProject } = await createOrg();
        await inviteAndJoinMember();
        const { createTargetAccessToken } = await createProject(projectType);
        const { secret } = await createTargetAccessToken({});

        await expect(
          schemaCheck([
            '--registry.accessToken',
            secret,
            ...serviceNameArgs,
            'fixtures/init-schema.graphql',
          ]),
        ).resolves.toMatchSnapshot('schemaCheck');
      },
    );

    test.concurrent('schema:check should throw on corrupted schema', async ({ expect }) => {
      const { createOrg } = await initSeed().createOwner();
      const { inviteAndJoinMember, createProject } = await createOrg();
      await inviteAndJoinMember();
      const { createTargetAccessToken } = await createProject(projectType);
      const { secret } = await createTargetAccessToken({});

      await expect(
        schemaCheck([
          ...serviceNameArgs,
          '--registry.accessToken',
          secret,
          'fixtures/missing-type.graphql',
        ]),
      ).rejects.toMatchSnapshot('schemaCheck');
    });

    test.concurrent(
      'schema:publish should see Invalid Token error when token is invalid',
      async ({ expect }) => {
        const invalidToken = createHash('md5').update('nope').digest('hex').substring(0, 31);
        await expect(
          schemaPublish([
            ...serviceNameArgs,
            ...serviceUrlArgs,
            '--registry.accessToken',
            invalidToken,
            'fixtures/init-schema.graphql',
          ]),
        ).rejects.toMatchSnapshot('schemaPublish');
      },
    );

    test
      .skipIf(projectType === ProjectType.Single)
      .concurrent(
        'can update the service url and show it in comparison query',
        async ({ expect }) => {
          const { createOrg } = await initSeed().createOwner();
          const { inviteAndJoinMember, createProject } = await createOrg();
          await inviteAndJoinMember();
          const { createTargetAccessToken, compareToPreviousVersion, fetchVersions } =
            await createProject(projectType);
          const { secret } = await createTargetAccessToken({});
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
          ).resolves.toMatchSnapshot('schemaPublish (initial)');

          const newServiceUrl = serviceUrl + '/new';
          await expect(
            cli.publish({
              sdl,
              commit: 'push2',
              serviceName,
              serviceUrl: newServiceUrl,
              expect: 'latest-composable',
            }),
          ).resolves.toMatchSnapshot('schemaPublish (new)');

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
        },
      );

    test
      .skipIf(projectType !== ProjectType.Federation)
      .concurrent(
        'can update a service without providing a url if previously published',
        async ({ expect }) => {
          const { createOrg } = await initSeed().createOwner();
          const { inviteAndJoinMember, createProject } = await createOrg();
          await inviteAndJoinMember();
          const { createTargetAccessToken, compareToPreviousVersion, fetchVersions } =
            await createProject(projectType);
          const { secret } = await createTargetAccessToken({});
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
          ).resolves.toMatchSnapshot('schema publish initial');

          const sdl2 = /* GraphQL */ `
            type Query {
              users: [User!]
            }

            type User {
              id: ID!
              name: String!
              email: String!
              phone: String
            }
          `;

          await expect(
            cli.publish({
              sdl: sdl2,
              commit: 'push2',
              serviceName,
              serviceUrl: undefined,
              expect: 'latest-composable',
            }),
          ).resolves.toMatchSnapshot('schema publish same url');

          const versions = await fetchVersions(3);
          expect(versions).toHaveLength(2);

          const versionWithNewServiceUrl = versions[0];

          const schema = versionWithNewServiceUrl.schemas.nodes?.[0];
          expect(schema.__typename).toBe('CompositeSchema');
          expect((schema as CompositeSchema).url).toBe('http://localhost:4000');

          expect(await compareToPreviousVersion(versionWithNewServiceUrl.id)).toEqual(
            expect.objectContaining({
              target: expect.objectContaining({
                schemaVersion: expect.objectContaining({
                  safeSchemaChanges: {
                    nodes: expect.anything(),
                  },
                  schemaCompositionErrors: null,
                }),
              }),
            }),
          );
        },
      );

    test.concurrent(
      'schema:fetch can fetch a schema with target:registry:read access',
      async ({ expect }) => {
        const { createOrg } = await initSeed().createOwner();
        const { inviteAndJoinMember, createProject } = await createOrg();
        await inviteAndJoinMember();
        const { createTargetAccessToken } = await createProject(projectType);
        const { secret, latestSchema } = await createTargetAccessToken({});

        const cli = createCLI({
          readonly: secret,
          readwrite: secret,
        });

        await expect(
          schemaPublish([
            '--registry.accessToken',
            secret,
            '--author',
            'Kamil',
            '--commit',
            'abc123',
            ...serviceNameArgs,
            ...serviceUrlArgs,
            'fixtures/init-schema.graphql',
          ]),
        ).resolves.toMatchSnapshot('schemaPublish');

        const schema = await latestSchema();
        const numSchemas = schema.latestVersion?.schemas.nodes.length;
        const fetchCmd = cli.fetch({
          type: 'subgraphs',
          commit: 'abc123',
        });
        const rHeader = `service\\s+url\\s+date`;
        const rUrl = `http:\\/\\/\\S+(:\\d+)?|n/a`;
        const rSubgraph = `[-]+\\s+\\S+\\s+(${rUrl})\\s+\\S+Z\\s+`;
        const rFooter = `subgraphs length: ${numSchemas}`;
        await expect(fetchCmd).resolves.toMatch(
          new RegExp(`${rHeader}\\s+(${rSubgraph}){${numSchemas}}${rFooter}`),
        );
      },
    );

    test
      /** federation relies on composeDirective which we don't test here */
      .skipIf(projectType === ProjectType.Federation)
      .concurrent(
        'schema:fetch sdl includes directives on the schema definition',
        async ({ expect }) => {
          const { createOrg } = await initSeed().createOwner();
          const { inviteAndJoinMember, createProject } = await createOrg();
          await inviteAndJoinMember();
          const { createTargetAccessToken } = await createProject(projectType);
          const { secret, latestSchema } = await createTargetAccessToken({});

          const cli = createCLI({
            readonly: secret,
            readwrite: secret,
          });

          await schemaPublish([
            '--registry.accessToken',
            secret,
            '--author',
            'Kamil',
            '--commit',
            'abc123',
            ...serviceNameArgs,
            ...serviceUrlArgs,
            'fixtures/schema-with-directives.graphql',
          ]);

          const schema = await latestSchema();
          const fetchCmd = cli.fetch({
            type: 'sdl',
            commit: 'abc123',
          });
          expect(schema.latestVersion?.sdl).toIncludeSubstringWithoutWhitespace(
            'type Query @public',
          );
          await expect(fetchCmd).resolves.toIncludeSubstringWithoutWhitespace('type Query @public');
          await expect(fetchCmd).resolves.toIncludeSubstringWithoutWhitespace(
            'directive @public on SCHEMA | OBJECT',
          );
        },
      );

    test.concurrent(
      'schema:fetch can fetch a latest schema with target:registry:read access',
      async ({ expect }) => {
        const { createOrg } = await initSeed().createOwner();
        const { inviteAndJoinMember, createProject } = await createOrg();
        await inviteAndJoinMember();
        const { createTargetAccessToken } = await createProject(projectType);
        const { secret } = await createTargetAccessToken({});

        const cli = createCLI({
          readonly: secret,
          readwrite: secret,
        });

        await expect(
          schemaPublish([
            '--registry.accessToken',
            secret,
            '--author',
            'Kamil',
            ...serviceNameArgs,
            ...serviceUrlArgs,
            'fixtures/init-schema.graphql',
          ]),
        ).resolves.toMatchSnapshot('schemaPublish');

        const fetchCmd = cli.fetch({
          type: 'sdl',
        });
        await expect(fetchCmd).resolves.toMatchSnapshot('latest sdl');
      },
    );

    test.skipIf(projectType !== ProjectType.Single)(
      'schema:check rejects a `--url` argument in single projects',
      async ({ expect }) => {
        const { createOrg } = await initSeed().createOwner();
        const { inviteAndJoinMember, createProject } = await createOrg();
        await inviteAndJoinMember();
        const { createTargetAccessToken } = await createProject(projectType);
        const { secret } = await createTargetAccessToken({});

        await expect(
          schemaCheck(
            [
              '--registry.accessToken',
              secret,
              '--service',
              'example',
              '--url',
              'https://example.graphql-hive.com/graphql',
              '--author',
              'Kamil',
              'fixtures/init-schema.graphql',
            ],
            {
              // set these environment variables to "emulate" a GitHub actions environment
              // We set GITHUB_EVENT_PATH to "" because on our CI it can be present and we want
              // consistent snapshot output behaviour.
              GITHUB_ACTIONS: '1',
              GITHUB_REPOSITORY: 'foo/foo',
              GITHUB_EVENT_PATH: '',
            },
          ),
        ).rejects.toMatchSnapshot();
      },
    );

    test.skipIf(projectType === ProjectType.Single)(
      'schema:check accepts a `--url` argument in distributed projects',
      async ({ expect }) => {
        const { createOrg } = await initSeed().createOwner();
        const { inviteAndJoinMember, createProject } = await createOrg();
        await inviteAndJoinMember();
        const { createTargetAccessToken } = await createProject(projectType);
        const { secret } = await createTargetAccessToken({});

        await expect(
          schemaCheck(
            [
              '--registry.accessToken',
              secret,
              '--service',
              'example',
              '--url',
              'https://example.graphql-hive.com/graphql',
              '--author',
              'Kamil',
              'fixtures/init-schema.graphql',
            ],
            {
              // set these environment variables to "emulate" a GitHub actions environment
              // We set GITHUB_EVENT_PATH to "" because on our CI it can be present and we want
              // consistent snapshot output behaviour.
              GITHUB_ACTIONS: '1',
              GITHUB_REPOSITORY: 'foo/foo',
              GITHUB_EVENT_PATH: '',
            },
          ),
        ).resolves.toMatchSnapshot();
      },
    );
  },
);

test.concurrent(
  'schema:publish with --target parameter matching the access token (slug)',
  async ({ expect }) => {
    const { createOrg } = await initSeed().createOwner();
    const { inviteAndJoinMember, createProject, organization } = await createOrg();
    await inviteAndJoinMember();
    const { createTargetAccessToken, project, target } = await createProject();
    const { secret } = await createTargetAccessToken({});

    const targetSlug = [organization.slug, project.slug, target.slug].join('/');

    await expect(
      schemaPublish([
        '--registry.accessToken',
        secret,
        '--author',
        'Kamil',
        '--target',
        targetSlug,
        'fixtures/init-schema.graphql',
      ]),
    ).resolves.toMatchInlineSnapshot(`
      :::::::::::::::: CLI SUCCESS OUTPUT :::::::::::::::::

      stdout--------------------------------------------:
      ✔ Published initial schema.
      ℹ Available at http://__URL__
    `);
  },
);

test.concurrent(
  'schema:publish with --target parameter matching the access token (UUID)',
  async ({ expect }) => {
    const { createOrg } = await initSeed().createOwner();
    const { inviteAndJoinMember, createProject } = await createOrg();
    await inviteAndJoinMember();
    const { createTargetAccessToken, target } = await createProject();
    const { secret } = await createTargetAccessToken({});

    await expect(
      schemaPublish([
        '--registry.accessToken',
        secret,
        '--author',
        'Kamil',
        '--target',
        target.id,
        'fixtures/init-schema.graphql',
      ]),
    ).resolves.toMatchInlineSnapshot(`
      :::::::::::::::: CLI SUCCESS OUTPUT :::::::::::::::::

      stdout--------------------------------------------:
      ✔ Published initial schema.
      ℹ Available at http://__URL__
    `);
  },
);

test.concurrent(
  'schema:publish fails with --target parameter not matching the access token (slug)',
  async ({ expect }) => {
    const { createOrg } = await initSeed().createOwner();
    const { inviteAndJoinMember, createProject } = await createOrg();
    await inviteAndJoinMember();
    const { createTargetAccessToken } = await createProject();
    const { secret } = await createTargetAccessToken({});

    const targetSlug = 'i/do/not-match';

    await expect(
      schemaPublish([
        '--registry.accessToken',
        secret,
        '--author',
        'Kamil',
        '--target',
        targetSlug,
        'fixtures/init-schema.graphql',
      ]),
    ).rejects.toMatchInlineSnapshot(`
      :::::::::::::::: CLI FAILURE OUTPUT :::::::::::::::
      exitCode------------------------------------------:
      1
      stderr--------------------------------------------:
       ›   Error: Access denied: the access token is missing the
       ›   "schemaVersion:publish" permission, or the target does not exist or is not
       ›    accessible to this token.  (Request ID: __REQUEST_ID__)  [124]
       ›   > See https://__URL__
       ›    for a complete list of error codes and recommended fixes.
       ›   To disable this message set HIVE_NO_ERROR_TIP=1
       ›   Reference: __ID__
      stdout--------------------------------------------:
      __NONE__
    `);
  },
);

test('schema:check gives correct error message for missing `--service` name flag in federation project', async ({
  expect,
}) => {
  const { createOrg } = await initSeed().createOwner();
  const { inviteAndJoinMember, createProject } = await createOrg();
  await inviteAndJoinMember();
  const { createTargetAccessToken } = await createProject(ProjectType.Federation);
  const { secret } = await createTargetAccessToken({});

  await expect(
    schemaCheck(
      [
        '--registry.accessToken',
        secret,
        '--github',
        '--author',
        'Kamil',
        'fixtures/init-schema.graphql',
      ],
      {
        // set these environment variables to "emulate" a GitHub actions environment
        // We set GITHUB_EVENT_PATH to "" because on our CI it can be present and we want
        // consistent snapshot output behaviour.
        GITHUB_ACTIONS: '1',
        GITHUB_REPOSITORY: 'foo/foo',
        GITHUB_EVENT_PATH: '',
      },
    ),
  ).rejects.toMatchInlineSnapshot(`
    :::::::::::::::: CLI FAILURE OUTPUT :::::::::::::::
    exitCode------------------------------------------:
    1
    stderr--------------------------------------------:
     ›   Warning: Could not resolve pull request number. Are you running this
     ›   command on a 'pull_request' or 'merge_group' event?
     ›   See https://__URL__
     ›   b-workflow-for-ci
     ›   Error: Schema check failed.  [202]
     ›   > See https://__URL__
     ›    for a complete list of error codes and recommended fixes.
     ›   To disable this message set HIVE_NO_ERROR_TIP=1
    stdout--------------------------------------------:
    ✖ Detected 1 error

       - Missing service name
  `);
});

test('schema:check without `--target` flag fails for organization access token', async ({
  expect,
}) => {
  const { createOrg } = await initSeed().createOwner();
  const { createOrganizationAccessToken } = await createOrg();
  const { privateAccessKey } = await createOrganizationAccessToken({
    permissions: ['schemaCheck:create', 'project:describe'],
    resources: {
      mode: GraphQLSchema.ResourceAssignmentModeType.All,
    },
  });

  await expect(
    schemaCheck([
      '--registry.accessToken',
      privateAccessKey,
      '--author',
      'Kamil',
      'fixtures/init-schema.graphql',
    ]),
  ).rejects.toMatchInlineSnapshot(`
    :::::::::::::::: CLI FAILURE OUTPUT :::::::::::::::
    exitCode------------------------------------------:
    3
    stderr--------------------------------------------:
     ›   Error: Missing 1 required argument:
     ›   TARGET 	The target on which the action is performed. This can either be a
     ›   slug following the format "$organizationSlug/$projectSlug/$targetSlug"
     ›   (e.g "the-guild/graphql-hive/staging") or an UUID (e.g.
     ›   "a0f4c605-6541-4350-8cfe-b31f21a4bf80").  [102]
     ›   > See https://__URL__
     ›    for a complete list of error codes and recommended fixes.
     ›   To disable this message set HIVE_NO_ERROR_TIP=1
    stdout--------------------------------------------:
    __NONE__
  `);
});

test('schema:check with `--target` flag succeeds for organization access token', async ({
  expect,
}) => {
  const { createOrg } = await initSeed().createOwner();
  const { createOrganizationAccessToken, createProject, organization } = await createOrg();
  const { project, target } = await createProject();
  const { privateAccessKey: privateKey } = await createOrganizationAccessToken({
    permissions: ['schemaCheck:create', 'project:describe'],
    resources: {
      mode: GraphQLSchema.ResourceAssignmentModeType.All,
    },
  });

  await expect(
    schemaCheck([
      '--registry.accessToken',
      privateKey,
      '--author',
      'Kamil',
      '--target',
      `${organization.slug}/${project.slug}/${target.slug}`,
      'fixtures/init-schema.graphql',
    ]),
  ).resolves.toMatchInlineSnapshot(`
    :::::::::::::::: CLI SUCCESS OUTPUT :::::::::::::::::

    stdout--------------------------------------------:
    ✔ Schema registry is empty, nothing to compare your schema with.
    View full report:
    http://__URL__
  `);
});

test('schema:publish without `--target` flag fails for organization access token', async ({
  expect,
}) => {
  const { createOrg } = await initSeed().createOwner();
  const { createOrganizationAccessToken } = await createOrg();
  const { privateAccessKey: privateKey } = await createOrganizationAccessToken({
    permissions: ['project:describe', 'schemaVersion:publish'],
    resources: {
      mode: GraphQLSchema.ResourceAssignmentModeType.All,
    },
  });

  await expect(
    schemaPublish([
      '--registry.accessToken',
      privateKey,
      '--author',
      'Kamil',

      'fixtures/init-schema.graphql',
    ]),
  ).rejects.toMatchInlineSnapshot(`
    :::::::::::::::: CLI FAILURE OUTPUT :::::::::::::::
    exitCode------------------------------------------:
    3
    stderr--------------------------------------------:
     ›   Error: Missing 1 required argument:
     ›   TARGET 	The target on which the action is performed. This can either be a
     ›   slug following the format "$organizationSlug/$projectSlug/$targetSlug"
     ›   (e.g "the-guild/graphql-hive/staging") or an UUID (e.g.
     ›   "a0f4c605-6541-4350-8cfe-b31f21a4bf80").  [102]
     ›   > See https://__URL__
     ›    for a complete list of error codes and recommended fixes.
     ›   To disable this message set HIVE_NO_ERROR_TIP=1
    stdout--------------------------------------------:
    __NONE__
  `);
});

test('schema:publish with `--target` flag succeeds for organization access token', async ({
  expect,
}) => {
  const { createOrg } = await initSeed().createOwner();
  const { createOrganizationAccessToken, organization, createProject } = await createOrg();
  const { project, target } = await createProject();
  const { privateAccessKey: privateKey } = await createOrganizationAccessToken({
    permissions: ['project:describe', 'schemaVersion:publish'],
    resources: {
      mode: GraphQLSchema.ResourceAssignmentModeType.All,
    },
  });

  await expect(
    schemaPublish([
      '--registry.accessToken',
      privateKey,
      '--author',
      'Kamil',
      '--target',
      `${organization.slug}/${project.slug}/${target.slug}`,
      'fixtures/init-schema.graphql',
    ]),
  ).resolves.toMatchInlineSnapshot(`
    :::::::::::::::: CLI SUCCESS OUTPUT :::::::::::::::::

    stdout--------------------------------------------:
    ✔ Published initial schema.
    ℹ Available at http://__URL__
  `);
});

test.concurrent(
  'schema:check --forceSafe auto-approves breaking changes using target access token',
  async ({ expect }) => {
    const { createOrg } = await initSeed().createOwner();
    const { createProject, organization } = await createOrg();
    const { createTargetAccessToken, project, target } = await createProject(ProjectType.Single);

    const writeToken = await createTargetAccessToken({
      mode: 'readWrite',
    });

    await schemaPublish([
      '--registry.accessToken',
      writeToken.secret,
      '--commit',
      'abc123',
      'fixtures/init-schema.graphql',
    ]);

    await expect(
      schemaCheck([
        '--registry.accessToken',
        writeToken.secret,
        '--commit',
        'def456',
        '--forceSafe',
        '--target',
        `${organization.slug}/${project.slug}/${target.slug}`,
        'fixtures/breaking-schema.graphql',
      ]),
    ).resolves.toContain('Breaking changes were expected (forced)');
  },
);

test.concurrent(
  'schema:check --forceSafe fails when schema policy errors prevent approval',
  async ({ expect }) => {
    const { createOrg } = await initSeed().createOwner();
    const { createProject, organization } = await createOrg();
    const { createTargetAccessToken, setProjectSchemaPolicy, project, target } =
      await createProject(ProjectType.Single);
    await setProjectSchemaPolicy(createPolicy(RuleInstanceSeverityLevel.Error));

    const writeToken = await createTargetAccessToken({
      mode: 'readWrite',
    });

    await schemaPublish([
      '--registry.accessToken',
      writeToken.secret,
      '--commit',
      'abc123',
      'fixtures/init-schema.graphql',
    ]);

    const message = await cliErrorMessage(
      schemaCheck([
        '--registry.accessToken',
        writeToken.secret,
        '--commit',
        'def456',
        '--forceSafe',
        '--target',
        `${organization.slug}/${project.slug}/${target.slug}`,
        'fixtures/breaking-schema.graphql',
      ]),
    );
    expect(message).toContain(
      'Failed to auto-approve the schema check: Schema check has schema policy errors',
    );
    expect(message).toContain('[203]');
  },
);

test.concurrent(
  'schema:check displays enum deprecation reason with single quotes correctly',
  async ({ expect }) => {
    const { createOrg } = await initSeed().createOwner();
    const { createProject } = await createOrg();
    const { createTargetAccessToken } = await createProject(ProjectType.Single);
    const { secret } = await createTargetAccessToken({});

    await schemaPublish([
      '--registry.accessToken',
      secret,
      '--author',
      'Test',
      '--commit',
      'init',
      'fixtures/enum-with-deprecation-init.graphql',
    ]);

    const result = await schemaCheck([
      '--registry.accessToken',
      secret,
      'fixtures/enum-with-deprecation-change.graphql',
    ]);

    expect(stripAnsi(result)).toContain(
      "Enum value Status.INACTIVE was deprecated with reason Use 'DISABLED' instead, it's clearer",
    );
  },
);

test.concurrent(
  'huge schema causing composition to go OOM gives correct error message',
  async ({ expect }) => {
    const { createOrg } = await initSeed().createOwner();
    const { createProject } = await createOrg();
    const { createTargetAccessToken } = await createProject(ProjectType.Federation);
    const { secret } = await createTargetAccessToken({});

    await expect(
      schemaCheck([
        '--registry.accessToken',
        secret,
        '--author',
        'Test',
        '--commit',
        'init',
        '--service foo',
        '--url http://localhost.localhost/graphql',
        'fixtures/huge-schema.graphql',
      ]),
    ).rejects.toMatchInlineSnapshot(`
      :::::::::::::::: CLI FAILURE OUTPUT :::::::::::::::
      exitCode------------------------------------------:
      1
      stderr--------------------------------------------:
       ›   Error: Schema check failed.  [202]
       ›   > See https://__URL__
       ›    for a complete list of error codes and recommended fixes.
       ›   To disable this message set HIVE_NO_ERROR_TIP=1
      stdout--------------------------------------------:
      ✖ Detected 1 error

         - Composition exceeded resource limits. Please contact the Hive Console Team.

      View full report:
      http://__URL__
    `);
  },
);

test.concurrent(
  'schema:publish rejects federation composition errors with --fail-on-composition-error',
  async ({ expect }) => {
    const { createOrg } = await initSeed().createOwner();
    const { createProject } = await createOrg();
    const { createTargetAccessToken } = await createProject(ProjectType.Federation);
    const { secret } = await createTargetAccessToken({});
    const validSchemaPath = join(tmpdir(), `valid-federation-schema-${randomUUID()}.graphql`);
    const invalidSchemaPath = join(tmpdir(), `invalid-federation-schema-${randomUUID()}.graphql`);

    await Promise.all([
      writeFile(
        validSchemaPath,
        /* GraphQL */ `
          type Query {
            user: User
          }

          type User @key(fields: "id") {
            id: ID!
          }
        `,
      ),
      writeFile(
        invalidSchemaPath,
        /* GraphQL */ `
          type Query {
            user: User
          }

          type User @key(fields: "missing") {
            id: ID!
          }
        `,
      ),
    ]);

    await schemaPublish([
      '--registry.accessToken',
      secret,
      '--commit',
      'valid',
      '--service',
      'users',
      '--url',
      'http://users.localhost',
      validSchemaPath,
    ]);

    await expect(
      schemaPublish([
        '--registry.accessToken',
        secret,
        '--commit',
        'invalid',
        '--service',
        'users',
        '--url',
        'http://users.localhost',
        '--fail-on-composition-error',
        invalidSchemaPath,
      ]),
    ).rejects.toThrow('- [users] On type User, for @key(fields: missing):');
  },
);

test.concurrent(
  'schema:publish prefixes contract composition errors with the contract name',
  async ({ expect }) => {
    const { createOrg, ownerToken } = await initSeed().createOwner();
    const { createProject } = await createOrg();
    const { createTargetAccessToken, target } = await createProject(ProjectType.Federation);
    const { secret, latestSchema } = await createTargetAccessToken({});

    await createContract(
      {
        target: { byId: target.id },
        contractName: 'my-contract',
        removeUnreachableTypesFromPublicApiSchema: true,
        excludeTags: ['internal'],
      },
      ownerToken,
    ).then(result => result.expectNoGraphQLErrors());

    const validSchemaPath = join(tmpdir(), `valid-contract-schema-${randomUUID()}.graphql`);
    const invalidSchemaPath = join(tmpdir(), `invalid-contract-schema-${randomUUID()}.graphql`);

    await Promise.all([
      writeFile(
        validSchemaPath,
        /* GraphQL */ `
          extend schema
            @link(url: "https://specs.apollo.dev/link/v1.0")
            @link(url: "https://specs.apollo.dev/federation/v2.0", import: ["@tag"])

          type Query {
            hello: String @tag(name: "internal")
            helloPublic: String
          }
        `,
      ),
      writeFile(
        invalidSchemaPath,
        /* GraphQL */ `
          extend schema
            @link(url: "https://specs.apollo.dev/link/v1.0")
            @link(url: "https://specs.apollo.dev/federation/v2.0", import: ["@tag"])

          type Query {
            hello: String @tag(name: "internal")
            helloPublic: String @tag(name: "internal")
          }
        `,
      ),
    ]);

    await schemaPublish([
      '--registry.accessToken',
      secret,
      '--commit',
      'valid-contract',
      '--service',
      'hello',
      '--url',
      'http://hello.localhost',
      validSchemaPath,
    ]);

    await expect(
      schemaPublish([
        '--registry.accessToken',
        secret,
        '--commit',
        'invalid-contract',
        '--service',
        'hello',
        '--url',
        'http://hello.localhost',
        '--fail-on-composition-error',
        invalidSchemaPath,
      ]),
    ).rejects.toThrow(
      '[my-contract] Type Query is in the API schema but all of its fields are @inaccessible.',
    );

    const latest = await latestSchema();
    expect(latest.latestVersion?.schemas.nodes[0]).toMatchObject({
      commit: 'valid-contract',
      source: expect.stringContaining('helloPublic: String'),
    });
  },
);

test.concurrent(
  'schema:check displays affected app deployments for breaking changes',
  async ({ expect }) => {
    const { createOrg } = await initSeed().createOwner();
    const { createProject, setFeatureFlag } = await createOrg();
    await setFeatureFlag('appDeployments', true);
    const { createTargetAccessToken } = await createProject(ProjectType.Single);
    const { secret } = await createTargetAccessToken({});

    await schemaPublish([
      '--registry.accessToken',
      secret,
      '--author',
      'Test',
      '--commit',
      'init',
      'fixtures/init-schema.graphql',
    ]);

    const operationsFile = join(tmpdir(), `operations-${randomUUID()}.json`);
    await writeFile(
      operationsFile,
      JSON.stringify({
        'op-hash-1': 'query GetUserEmails { users { id email } }',
        'op-hash-2': 'query GetUserProfile { users { id name email } }',
      }),
    );

    await appCreate([
      '--registry.accessToken',
      secret,
      '--name',
      'test-app',
      '--version',
      '1.0.0',
      operationsFile,
    ]);

    await appPublish([
      '--registry.accessToken',
      secret,
      '--name',
      'test-app',
      '--version',
      '1.0.0',
    ]);

    try {
      await schemaCheck(['--registry.accessToken', secret, 'fixtures/breaking-schema.graphql']);
      expect.fail('Expected schema check to fail with breaking changes');
    } catch (error: any) {
      const output = stripAnsi(error.message || error.stderr || String(error));
      expect(output).toContain('[1 app deployment affected]');
    }
  },
);

test.concurrent('schema:publish ignores SDL formatting', async ({ expect }) => {
  const { createOrg } = await initSeed().createOwner();
  const { inviteAndJoinMember, createProject, organization } = await createOrg();
  await inviteAndJoinMember();
  const { createTargetAccessToken, project, target } = await createProject(ProjectType.Federation);
  const { secret, latestSchema } = await createTargetAccessToken({});

  const targetSlug = [organization.slug, project.slug, target.slug].join('/');

  await expect(
    schemaPublish([
      '--registry.accessToken',
      secret,
      '--author',
      'Kamil',
      '--target',
      targetSlug,
      '--service',
      'whitespace',
      '--url',
      'https://example.graphql-hive.com/graphql',
      'fixtures/whitespace-oddity.graphql',
    ]),
  ).resolves.toMatchInlineSnapshot(`
      :::::::::::::::: CLI SUCCESS OUTPUT :::::::::::::::::

      stdout--------------------------------------------:
      ✔ Published initial schema.
      ℹ Available at http://__URL__
    `);

  const latest = await latestSchema();
  expect(latest.latestVersion?.isValid).toBe(true);
  expect(latest.latestVersion?.schemas.nodes?.[0]?.source).toMatchInlineSnapshot(`
    directive @inline on FIELD_DEFINITION

    """
    Multi line description:
    1. Foo
    2. Bar
    3. Should stay in a list format

    # with single line comment
    """
    type Query {
      status: Status @inline
      value: Boolean @deprecated
    }

    enum Status {
      ACTIVE
      INACTIVE
      PENDING
    }

    type User

    extend type User {
      id: ID!
      email: String
    }
  `);

  // API Schema maintains the multiline description's formatting
  expect(latest.latestVersion?.sdl).toEqual(
    expect.stringContaining(`"""
Multi line description:
1. Foo
2. Bar
3. Should stay in a list format

# with single line comment
"""`),
  );

  // Supergraph maintains formatting
  expect(latest.latestVersion?.supergraph).toEqual(
    expect.stringContaining(`"""
Multi line description:
1. Foo
2. Bar
3. Should stay in a list format

# with single line comment
"""`),
  );
});

test.concurrent('schema:check ignores SDL formatting', async ({ expect }) => {
  const { createOrg, ownerToken } = await initSeed().createOwner();
  const { inviteAndJoinMember, createProject, organization } = await createOrg();
  await inviteAndJoinMember();
  const { createTargetAccessToken, project, target } = await createProject(ProjectType.Federation);
  const { latestSchema, latestSchemaCheck } = await createTargetAccessToken({});

  const targetSlug = [organization.slug, project.slug, target.slug].join('/');

  // publish multiple subgraphs to ensure composition is processing and merging them
  await expect(
    schemaPublish([
      '--registry.accessToken',
      ownerToken,
      '--author',
      'me',
      '--target',
      targetSlug,
      '--service',
      'x',
      '--url',
      'https://x.graphql-hive.com/graphql',
      'fixtures/federation-00.graphql',
    ]),
  ).resolves.not.toThrow();

  await expect(
    schemaPublish([
      '--registry.accessToken',
      ownerToken,
      '--author',
      'me',
      '--target',
      targetSlug,
      '--service',
      'y',
      '--url',
      'https://y.graphql-hive.com/graphql',
      'fixtures/federation-01.graphql',
    ]),
  ).resolves.not.toThrow();

  const { latestVersion } = await latestSchema();
  expect(latestVersion?.isValid).toBe(true);

  // check the exact same schema
  await expect(
    schemaCheck([
      '--registry.accessToken',
      ownerToken,
      '--target',
      targetSlug,
      '--author',
      'me',
      '--commit',
      'abc1234',
      '--service',
      'y',
      '--url',
      'https://y.graphql-hive.com/graphql',
      'fixtures/federation-01.graphql',
    ]),
  ).resolves.not.toThrow();

  const lastCheckId = await latestSchemaCheck();
  const details = await getSchemaCheckDetails(
    {
      byId: target.id,
    },
    lastCheckId!,
    ownerToken,
  ).then(r => r.expectNoGraphQLErrors());

  // compare the check's SDLs to the schema version's SDLs
  const lastCheck = details.target?.schemaCheck!;
  expect(lastCheck.__typename).toBe('SuccessfulSchemaCheck');
  assert(lastCheck.__typename === 'SuccessfulSchemaCheck');

  expect(lastCheck.supergraphSDL).toEqual(lastCheck.schemaVersion?.supergraph);
  expect(lastCheck.compositeSchemaSDL).toEqual(lastCheck.schemaVersion?.sdl);
  expect(lastCheck.schemaSDL).toEqual(lastCheck.previousSchemaSDL);
});

test.concurrent(
  'schema:check malformed descriptions do not result in changes publish',
  async () => {
    const { createOrg } = await initSeed().createOwner();
    const { inviteAndJoinMember, createProject } = await createOrg();
    await inviteAndJoinMember();
    const { createTargetAccessToken } = await createProject(ProjectType.Single);
    const { secret } = await createTargetAccessToken({});

    await expect(
      schemaPublish([
        '--registry.accessToken',
        secret,
        '--author',
        'jdolle',
        '--commit',
        'abc123',
        'fixtures/comments-to-descriptions.graphql',
      ]),
    ).resolves.toContain('Published initial schema');

    await expect(
      schemaCheck([
        '--registry.accessToken',
        secret,
        '--commit',
        'abc1234',
        'fixtures/comments-to-descriptions.graphql',
      ]),
    ).resolves.toContain('No changes');
  },
);

test.concurrent('schema:check works with federated subgraphs', async () => {
  const server = await createServer({
    sentryErrorHandler: false,
    log: {
      requests: false,
      level: 'silent',
    },
    name: '',
  });

  const yogaFederation = createYoga({
    logging: false,
    plugins: [useDisableIntrospection()],
    schema: buildSubgraphSchema({
      typeDefs: parse(/* GraphQL */ `
        extend type Query {
          me: User
          user(id: ID!): User
          users: [User]
        }

        type User @key(fields: "id") {
          id: ID!
          name: String
          username: String
        }
      `),
    }),
  });

  server.route({
    // Bind to the Yoga's endpoint to avoid rendering on any path
    url: yogaFederation.graphqlEndpoint,
    method: ['GET', 'POST', 'OPTIONS'],
    handler: (req, reply) => yogaFederation.handleNodeRequestAndResponse(req, reply),
  });

  await server.listen({
    port: 0,
    host: '0.0.0.0',
  });

  const url = 'http://localhost:' + (server.server.address() as AddressInfo).port;

  const { createOrg } = await initSeed().createOwner();
  const { inviteAndJoinMember, createProject } = await createOrg();
  await inviteAndJoinMember();
  const { createTargetAccessToken } = await createProject(ProjectType.Single);
  const { secret } = await createTargetAccessToken({});

  await expect(
    schemaPublish([
      '--registry.accessToken',
      secret,
      '--author',
      'jdolle',
      '--commit',
      'abc123',
      url + yogaFederation.graphqlEndpoint,
    ]),
  ).resolves.toContain('Published initial schema');

  await expect(
    schemaCheck([
      '--registry.accessToken',
      secret,
      '--commit',
      'abc1234',
      url + yogaFederation.graphqlEndpoint,
    ]),
  ).resolves.toContain('No changes');

  await server.close();
});

test.concurrent(
  'schema:check errors for dangerous changes when upgraded to breaking changes (fail all)',
  async ({ expect }) => {
    const { createOrg } = await initSeed().createOwner();
    const { inviteAndJoinMember, createProject } = await createOrg();
    await inviteAndJoinMember();
    const {
      createTargetAccessToken,
      updateTargetFailingDangerousChanges,
      updateTargetDangerousChangeClassification,
      target,
    } = await createProject(ProjectType.Single);
    const { secret } = await createTargetAccessToken({});
    const cli = createCLI({
      readonly: secret,
      readwrite: secret,
    });

    // enable: dangerous change -> breaking
    await updateTargetDangerousChangeClassification({
      failDiffOnDangerousChange: true,
      target,
    });
    /** Explicitly specify failing dangerous type condition */
    await updateTargetFailingDangerousChanges({
      all: true,
      failingTypes: [],
      target,
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

      enum UserType {
        CUSTOMER
      }
    `;

    await expect(
      cli.publish({
        sdl,
        commit: 'push1',
        expect: 'latest-composable',
      }),
    ).resolves.toMatchSnapshot('schemaPublish (initial)');

    // add an enum value
    const sdl2 = /* GraphQL */ `
      type Query {
        users: [User!]
      }

      type User {
        id: ID!
        name: String!
        email: String!
      }

      enum UserType {
        CUSTOMER
        ADMIN
      }
    `;

    const output = await cli.check({
      sdl: sdl2,
      expect: 'rejected',
    });
    /** remove colors */
    const cleanOutput = output.replace(/\x1b\[[0-9;]*m/g, '');
    expect(cleanOutput).toMatch(/Enum value ADMIN was added to enum UserType/);
  },
);

test.concurrent(
  'schema:check errors for dangerous changes when upgraded to breaking changes (fail specific change type)',
  async ({ expect }) => {
    const { createOrg } = await initSeed().createOwner();
    const { inviteAndJoinMember, createProject } = await createOrg();
    await inviteAndJoinMember();
    const {
      createTargetAccessToken,
      updateTargetFailingDangerousChanges,
      updateTargetDangerousChangeClassification,
      target,
    } = await createProject(ProjectType.Single);
    const { secret } = await createTargetAccessToken({});
    const cli = createCLI({
      readonly: secret,
      readwrite: secret,
    });

    // enable: dangerous change -> breaking
    await updateTargetDangerousChangeClassification({
      failDiffOnDangerousChange: true,
      target,
    });
    /** Explicitly specify failing dangerous type condition */
    await updateTargetFailingDangerousChanges({
      all: false,
      failingTypes: [GraphQLSchema.DangerousChangeType.EnumValueAdded],
      target,
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

      enum UserType {
        CUSTOMER
      }
    `;

    await expect(
      cli.publish({
        sdl,
        commit: 'push1',
        expect: 'latest-composable',
      }),
    ).resolves.toMatchSnapshot('schemaPublish (initial)');

    // add an enum value
    const sdl2 = /* GraphQL */ `
      type Query {
        users: [User!]
      }

      type User {
        id: ID!
        name: String!
        email: String!
      }

      enum UserType {
        CUSTOMER
        ADMIN
      }
    `;

    const output = await cli.check({
      sdl: sdl2,
      expect: 'rejected',
    });
    /** remove colors */
    const cleanOutput = output.replace(/\x1b\[[0-9;]*m/g, '');
    expect(cleanOutput).toMatch(/Enum value ADMIN was added to enum UserType/);
  },
);

test.concurrent(
  'schema:check passes for dangerous changes when upgraded to breaking changes, if type is not in the failing list',
  async ({ expect }) => {
    const { createOrg } = await initSeed().createOwner();
    const { inviteAndJoinMember, createProject } = await createOrg();
    await inviteAndJoinMember();
    const {
      createTargetAccessToken,
      updateTargetFailingDangerousChanges,
      updateTargetDangerousChangeClassification,
      target,
    } = await createProject(ProjectType.Single);
    const { secret } = await createTargetAccessToken({});
    const cli = createCLI({
      readonly: secret,
      readwrite: secret,
    });

    // enable: dangerous change -> breaking
    await updateTargetDangerousChangeClassification({
      failDiffOnDangerousChange: true,
      target,
    });
    /** Explicitly specify failing dangerous type condition */
    await updateTargetFailingDangerousChanges({
      all: false,
      failingTypes: [GraphQLSchema.DangerousChangeType.DirectiveArgumentDefaultValueChanged],
      target,
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

      enum UserType {
        CUSTOMER
      }
    `;

    await expect(
      cli.publish({
        sdl,
        commit: 'push1',
        expect: 'latest-composable',
      }),
    ).resolves.toMatchSnapshot('schemaPublish (initial)');

    // add an enum value
    const sdl2 = /* GraphQL */ `
      type Query {
        users: [User!]
      }

      type User {
        id: ID!
        name: String!
        email: String!
      }

      enum UserType {
        CUSTOMER
        ADMIN
      }
    `;

    const output = await cli.check({
      sdl: sdl2,
      expect: 'approved',
    });
    /** remove colors */
    const cleanOutput = output.replace(/\x1b\[[0-9;]*m/g, '');
    expect(cleanOutput).toMatch(/Enum value ADMIN was added to enum UserType/);
  },
);
