import { createPool, sql } from 'slonik';
import {
  OrganizationAccessScope,
  ProjectAccessScope,
  ProjectType,
  RegistryModel,
  SchemaPolicyInput,
  TargetAccessScope,
} from '@app/gql/graphql';
import { authenticate, userEmail } from './auth';
import {
  CreateCollectionMutation,
  CreateOperationMutation,
  DeleteCollectionMutation,
  DeleteOperationMutation,
  UpdateCollectionMutation,
  UpdateOperationMutation,
} from './collections';
import { ensureEnv } from './env';
import {
  checkSchema,
  compareToPreviousVersion,
  createCdnAccess,
  createOrganization,
  createProject,
  createToken,
  deleteSchema,
  deleteTokens,
  fetchLatestSchema,
  fetchLatestValidSchema,
  fetchMetadataFromCDN,
  fetchSchemaFromCDN,
  fetchSupergraphFromCDN,
  fetchVersions,
  getOrganization,
  getOrganizationMembers,
  inviteToOrganization,
  joinOrganization,
  publishSchema,
  readOperationBody,
  readOperationsStats,
  readTokenInfo,
  setTargetValidation,
  updateBaseSchema,
  updateMemberAccess,
  updateRegistryModel,
  updateSchemaVersionStatus,
} from './flow';
import { execute } from './graphql';
import { UpdateSchemaPolicyForOrganization, UpdateSchemaPolicyForProject } from './schema-policy';
import { collect, CollectedOperation } from './usage';
import { generateUnique } from './utils';

export function initSeed() {
  const pg = {
    user: ensureEnv('POSTGRES_USER'),
    password: ensureEnv('POSTGRES_PASSWORD'),
    host: ensureEnv('POSTGRES_HOST'),
    port: ensureEnv('POSTGRES_PORT'),
    db: ensureEnv('POSTGRES_DB'),
  };
  const poolPromise = createPool(
    `postgres://${pg.user}:${pg.password}@${pg.host}:${pg.port}/${pg.db}?sslmode=disable`,
  );

  return {
    authenticate: authenticate,
    generateEmail: () => userEmail(generateUnique()),
    async createOwner() {
      const ownerEmail = userEmail(generateUnique());
      const ownerToken = await authenticate(ownerEmail).then(r => r.access_token);

      return {
        ownerEmail,
        ownerToken,
        async createOrg() {
          const orgName = generateUnique();
          const orgResult = await createOrganization({ name: orgName }, ownerToken).then(r =>
            r.expectNoGraphQLErrors(),
          );

          const organization =
            orgResult.createOrganization.ok!.createdOrganizationPayload.organization;

          return {
            organization,
            async setFeatureFlag(name: string, enabled: boolean) {
              const pool = await poolPromise;

              await pool.query(sql`
                UPDATE public.organizations SET feature_flags = ${sql.jsonb({
                  [name]: enabled,
                })}
                WHERE id = ${organization.id}
              `);
            },
            async setOrganizationSchemaPolicy(policy: SchemaPolicyInput, allowOverrides: boolean) {
              const result = await execute({
                document: UpdateSchemaPolicyForOrganization,
                variables: {
                  allowOverrides,
                  selector: {
                    organization: organization.cleanId,
                  },
                  policy,
                },
                authToken: ownerToken,
              }).then(r => r.expectNoGraphQLErrors());

              return result.updateSchemaPolicyForOrganization;
            },
            async fetchOrganizationInfo() {
              const result = await getOrganization(organization.cleanId, ownerToken).then(r =>
                r.expectNoGraphQLErrors(),
              );

              return result.organization!.organization;
            },
            async inviteMember(email = 'some@email.com') {
              const inviteResult = await inviteToOrganization(
                {
                  email,
                  organization: organization.cleanId,
                },
                ownerToken,
              ).then(r => r.expectNoGraphQLErrors());

              return inviteResult.inviteToOrganizationByEmail;
            },
            async joinMemberUsingCode(inviteCode: string, memberToken: string) {
              return await joinOrganization(inviteCode, memberToken);
            },
            async members() {
              const membersResult = await getOrganizationMembers(
                { organization: organization.cleanId },
                ownerToken,
              ).then(r => r.expectNoGraphQLErrors());

              const members = membersResult.organization?.organization.members.nodes;

              if (!members) {
                throw new Error(`Could not get members for org ${organization.cleanId}`);
              }

              return members;
            },
            async createProject(
              projectType: ProjectType,
              options?: {
                useLegacyRegistryModels?: boolean;
              },
            ) {
              const useLegacyRegistryModels = options?.useLegacyRegistryModels === true;
              const projectResult = await createProject(
                {
                  organization: organization.cleanId,
                  type: projectType,
                  name: generateUnique(),
                },
                ownerToken,
              ).then(r => r.expectNoGraphQLErrors());

              const targets = projectResult.createProject.ok!.createdTargets;
              const target = targets[0];
              const project = projectResult.createProject.ok!.createdProject;

              if (useLegacyRegistryModels) {
                await updateRegistryModel(
                  {
                    organization: organization.cleanId,
                    project: projectResult.createProject.ok!.createdProject.cleanId,
                    model: RegistryModel.Legacy,
                  },
                  ownerToken,
                ).then(r => r.expectNoGraphQLErrors());
              }

              return {
                project,
                targets,
                target,
                async setProjectSchemaPolicy(policy: SchemaPolicyInput) {
                  const result = await execute({
                    document: UpdateSchemaPolicyForProject,
                    variables: {
                      selector: {
                        organization: organization.cleanId,
                        project: project.cleanId,
                      },
                      policy,
                    },
                    authToken: ownerToken,
                  }).then(r => r.expectNoGraphQLErrors());

                  return result.updateSchemaPolicyForProject;
                },
                async removeTokens(tokenIds: string[]) {
                  return await deleteTokens(
                    {
                      organization: organization.cleanId,
                      project: project.cleanId,
                      target: target.cleanId,
                      tokens: tokenIds,
                    },
                    ownerToken,
                  )
                    .then(r => r.expectNoGraphQLErrors())
                    .then(r => r.deleteTokens.deletedTokens);
                },
                async createDocumentCollection({
                  name,
                  description,
                  token = ownerToken,
                }: {
                  name: string;
                  description: string;
                  token?: string;
                }) {
                  const result = await execute({
                    document: CreateCollectionMutation,
                    variables: {
                      input: {
                        name,
                        description,
                      },
                      selector: {
                        organization: organization.cleanId,
                        project: project.cleanId,
                        target: target.cleanId,
                      },
                    },
                    authToken: token,
                  }).then(r => r.expectNoGraphQLErrors());

                  return result.createDocumentCollection;
                },
                async updateDocumentCollection({
                  collectionId,
                  name,
                  description,
                  token = ownerToken,
                }: {
                  collectionId: string;
                  name: string;
                  description: string;
                  token?: string;
                }) {
                  const result = await execute({
                    document: UpdateCollectionMutation,
                    variables: {
                      input: {
                        collectionId,
                        name,
                        description,
                      },
                      selector: {
                        organization: organization.cleanId,
                        project: project.cleanId,
                        target: target.cleanId,
                      },
                    },
                    authToken: token,
                  }).then(r => r.expectNoGraphQLErrors());

                  return result.updateDocumentCollection;
                },
                async deleteDocumentCollection({
                  collectionId,
                  token = ownerToken,
                }: {
                  collectionId: string;
                  token?: string;
                }) {
                  const result = await execute({
                    document: DeleteCollectionMutation,
                    variables: {
                      id: collectionId,
                      selector: {
                        organization: organization.cleanId,
                        project: project.cleanId,
                        target: target.cleanId,
                      },
                    },
                    authToken: token,
                  }).then(r => r.expectNoGraphQLErrors());

                  return result.deleteDocumentCollection;
                },
                async createOperationInCollection(input: {
                  collectionId: string;
                  name: string;
                  query: string;
                  variables?: Record<string, string>;
                  headers?: Record<string, string>;
                  token?: string;
                }) {
                  const result = await execute({
                    document: CreateOperationMutation,
                    variables: {
                      input: {
                        collectionId: input.collectionId,
                        name: input.name,
                        query: input.query,
                        headers: input.headers,
                        variables: input.variables,
                      },
                      selector: {
                        organization: organization.cleanId,
                        project: project.cleanId,
                        target: target.cleanId,
                      },
                    },
                    authToken: input.token || ownerToken,
                  }).then(r => r.expectNoGraphQLErrors());

                  return result.createOperationInDocumentCollection;
                },
                async deleteOperationInCollection(input: { operationId: string; token?: string }) {
                  const result = await execute({
                    document: DeleteOperationMutation,
                    variables: {
                      id: input.operationId,
                      selector: {
                        organization: organization.cleanId,
                        project: project.cleanId,
                        target: target.cleanId,
                      },
                    },
                    authToken: input.token || ownerToken,
                  }).then(r => r.expectNoGraphQLErrors());

                  return result.deleteOperationInDocumentCollection;
                },
                async updateOperationInCollection(input: {
                  operationId: string;
                  collectionId: string;
                  name: string;
                  query: string;
                  variables?: Record<string, string>;
                  headers?: Record<string, string>;
                  token?: string;
                }) {
                  const result = await execute({
                    document: UpdateOperationMutation,
                    variables: {
                      input: {
                        operationId: input.operationId,
                        collectionId: input.collectionId,
                        name: input.name,
                        query: input.query,
                        headers: input.headers,
                        variables: input.variables,
                      },
                      selector: {
                        organization: organization.cleanId,
                        project: project.cleanId,
                        target: target.cleanId,
                      },
                    },
                    authToken: input.token || ownerToken,
                  }).then(r => r.expectNoGraphQLErrors());

                  return result.updateOperationInDocumentCollection;
                },
                async createToken({
                  targetScopes = [TargetAccessScope.RegistryRead, TargetAccessScope.RegistryWrite],
                  projectScopes = [],
                  organizationScopes = [],
                  targetId = target.cleanId,
                  actorToken = ownerToken,
                }: {
                  targetScopes?: TargetAccessScope[];
                  projectScopes?: ProjectAccessScope[];
                  organizationScopes?: OrganizationAccessScope[];
                  targetId?: string;
                  actorToken?: string;
                }) {
                  const tokenResult = await createToken(
                    {
                      name: generateUnique(),
                      organization: organization.cleanId,
                      project: project.cleanId,
                      target: targetId,
                      organizationScopes: organizationScopes,
                      projectScopes: projectScopes,
                      targetScopes: targetScopes,
                    },
                    actorToken,
                  ).then(r => r.expectNoGraphQLErrors());

                  const secret = tokenResult.createToken.ok!.secret;
                  const token = tokenResult.createToken.ok!.createdToken;

                  return {
                    token,
                    secret,
                    async readOperationBody(hash: string) {
                      const operationBodyResult = await readOperationBody(
                        {
                          organization: organization.cleanId,
                          project: project.cleanId,
                          target: target.cleanId,
                          hash,
                        },
                        secret,
                      ).then(r => r.expectNoGraphQLErrors());

                      return operationBodyResult.operationBodyByHash;
                    },
                    async readOperationsStats(from: string, to: string) {
                      const statsResult = await readOperationsStats(
                        {
                          organization: organization.cleanId,
                          project: project.cleanId,
                          target: target.cleanId,
                          period: {
                            from,
                            to,
                          },
                        },
                        secret,
                      ).then(r => r.expectNoGraphQLErrors());

                      return statsResult.operationsStats;
                    },
                    async collectOperations(
                      operations: CollectedOperation[],
                      headerName: 'x-api-token' | 'authorization' = 'authorization',
                    ) {
                      return await collect({
                        operations,
                        token: secret,
                        authorizationHeader: headerName,
                      });
                    },
                    async checkSchema(sdl: string, service?: string) {
                      return await checkSchema(
                        {
                          sdl,
                          service,
                        },
                        secret,
                      );
                    },
                    async toggleTargetValidation(enabled: boolean) {
                      const result = await setTargetValidation(
                        {
                          enabled,
                          target: target.cleanId,
                          project: project.cleanId,
                          organization: organization.cleanId,
                        },
                        {
                          token: secret,
                        },
                      ).then(r => r.expectNoGraphQLErrors());

                      return result;
                    },
                    async fetchMetadataFromCDN() {
                      return fetchMetadataFromCDN(
                        {
                          organization: organization.cleanId,
                          project: project.cleanId,
                          target: target.cleanId,
                        },
                        secret,
                      );
                    },
                    async updateSchemaVersionStatus(version: string, valid: boolean) {
                      return await updateSchemaVersionStatus(
                        {
                          organization: organization.cleanId,
                          project: project.cleanId,
                          target: target.cleanId,
                          valid,
                          version,
                        },
                        secret,
                      ).then(r => r.expectNoGraphQLErrors());
                    },
                    async fetchSchemaFromCDN() {
                      return fetchSchemaFromCDN(
                        {
                          organization: organization.cleanId,
                          project: project.cleanId,
                          target: target.cleanId,
                        },
                        secret,
                      );
                    },
                    async createCdnAccess() {
                      const result = await createCdnAccess(
                        {
                          organization: organization.cleanId,
                          project: project.cleanId,
                          target: target.cleanId,
                        },
                        secret,
                      ).then(r => r.expectNoGraphQLErrors());

                      expect(result.createCdnAccessToken.ok).not.toBeNull();

                      return result.createCdnAccessToken.ok!;
                    },
                    async publishSchema(options: {
                      sdl: string;
                      headerName?: 'x-api-token' | 'authorization';
                      author?: string;
                      force?: boolean;
                      experimental_acceptBreakingChanges?: boolean;
                      commit?: string;
                      service?: string;
                      url?: string;
                      metadata?: string;
                    }) {
                      return await publishSchema(
                        {
                          author: options.author || 'Kamil',
                          commit: options.commit || 'test',
                          sdl: options.sdl,
                          service: options.service,
                          url: options.url,
                          force: options.force,
                          metadata: options.metadata,
                          experimental_acceptBreakingChanges:
                            options.experimental_acceptBreakingChanges,
                        },
                        secret,
                        options.headerName || 'authorization',
                      );
                    },
                    async deleteSchema(serviceName: string) {
                      return await deleteSchema(
                        {
                          serviceName,
                          dryRun: false,
                        },
                        secret,
                      );
                    },
                    async latestSchema() {
                      return (await fetchLatestSchema(secret)).expectNoGraphQLErrors();
                    },
                    async fetchLatestValidSchema() {
                      return (await fetchLatestValidSchema(secret)).expectNoGraphQLErrors();
                    },
                    async compareToPreviousVersion(version: string) {
                      return (
                        await compareToPreviousVersion(
                          {
                            organization: organization.cleanId,
                            project: project.cleanId,
                            target: target.cleanId,
                            version,
                          },
                          secret,
                        )
                      ).expectNoGraphQLErrors();
                    },
                    async updateBaseSchema(newBase: string) {
                      const result = await updateBaseSchema(
                        {
                          newBase,
                          organization: organization.cleanId,
                          project: project.cleanId,
                          target: target.cleanId,
                        },
                        secret,
                      ).then(r => r.expectNoGraphQLErrors());

                      return result.updateBaseSchema;
                    },
                    async fetchVersions(count: number) {
                      const result = await fetchVersions(
                        {
                          organization: organization.cleanId,
                          project: project.cleanId,
                          target: target.cleanId,
                        },
                        count,
                        secret,
                      ).then(r => r.expectNoGraphQLErrors());

                      return result.schemaVersions.nodes;
                    },
                    async fetchTokenInfo() {
                      const tokenInfoResult = await readTokenInfo(secret).then(r =>
                        r.expectNoGraphQLErrors(),
                      );

                      return tokenInfoResult.tokenInfo;
                    },
                    async fetchSupergraph() {
                      const supergraphResponse = await fetchSupergraphFromCDN(
                        {
                          organization: organization.cleanId,
                          project: project.cleanId,
                          target: target.cleanId,
                        },
                        secret,
                      );

                      if (supergraphResponse.status !== 200) {
                        throw new Error(
                          `Could not fetch supergraph for org ${organization.cleanId} project ${project.cleanId} target ${target.cleanId}`,
                        );
                      }

                      return supergraphResponse.body;
                    },
                  };
                },
              };
            },
            async inviteAndJoinMember() {
              const memberEmail = userEmail(generateUnique());
              const memberToken = await authenticate(memberEmail).then(r => r.access_token);

              const invitationResult = await inviteToOrganization(
                {
                  organization: organization.cleanId,
                  email: memberEmail,
                },
                ownerToken,
              ).then(r => r.expectNoGraphQLErrors());

              const code = invitationResult.inviteToOrganizationByEmail.ok?.code;

              if (!code) {
                throw new Error(
                  `Could not create invitation for ${memberEmail} to join org ${organization.cleanId}`,
                );
              }

              const joinResult = await joinOrganization(code, memberToken).then(r =>
                r.expectNoGraphQLErrors(),
              );

              if (joinResult.joinOrganization.__typename !== 'OrganizationPayload') {
                throw new Error(
                  `Member ${memberEmail} could not join organization ${organization.cleanId}`,
                );
              }

              const member = joinResult.joinOrganization.organization.me;

              return {
                member,
                memberEmail,
                memberToken,
                async updateMemberAccess(
                  targetScopes: TargetAccessScope[] = [],
                  projectScopes: ProjectAccessScope[] = [],
                  organizationScopes: OrganizationAccessScope[] = [],
                  options: { useMemberToken?: boolean } = {
                    useMemberToken: false,
                  },
                ) {
                  const updateResult = await updateMemberAccess(
                    {
                      organization: organization.cleanId,
                      organizationScopes: organizationScopes,
                      projectScopes: projectScopes,
                      targetScopes: targetScopes,
                      user: member.id,
                    },
                    options.useMemberToken ? memberToken : ownerToken,
                  ).then(r => r.expectNoGraphQLErrors());

                  return updateResult.updateOrganizationMemberAccess.organization;
                },
              };
            },
          };
        },
      };
    },
  };
}
