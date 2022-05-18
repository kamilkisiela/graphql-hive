test.todo('move the code below to integration tests');

// /* eslint-disable import/no-extraneous-dependencies */
// import 'reflect-metadata';
// import { testkit } from 'graphql-modules';
// import { parse } from 'graphql';
// import { schemaModule } from '../index';
// import { sharedModule } from '../../shared/index';
// import { Logger } from '../../shared/providers/logger';
// import { Storage } from '../../shared/providers/storage';
// import { ProjectManager } from '../../project/providers/project-manager';
// import {
//   ProjectType,
//   OrganizationType,
//   Organization,
//   Project,
//   Target,
// } from '../../../shared/entities';
// import { TargetManager } from '../../target/providers/target-manager';
// import { OrganizationManager } from '../../organization/providers/organization-manager';
// import { AuthManager } from '../../auth/providers/auth-manager';
// import { HttpClient } from '../../shared/providers/http-client';
// import { Tracking } from '../../shared/providers/tracking';
// import { REDIS_INSTANCE } from '../../shared/providers/redis';
// import { OperationsManager } from '../../operations/providers/operations-manager';
// import { AlertsManager } from '../../alerts/providers/alerts-manager';
// import { CdnProvider } from '../../cdn/providers/cdn.provider';

// const Redis = require('ioredis-mock');

// const schemaPublishMutation = parse(/* GraphQL */ `
//   mutation schemaPublish(
//     $input: SchemaPublishInput!
//     $includeMissingServiceError: Boolean = false
//   ) {
//     schemaPublish(input: $input) {
//       __typename
//       ... on SchemaPublishSuccess {
//         initial
//         valid
//         message
//         changes {
//           total
//           nodes {
//             criticality
//             path
//           }
//         }
//       }
//       ... on SchemaPublishError {
//         valid
//         changes {
//           total
//           nodes {
//             criticality
//             path
//           }
//         }
//         errors {
//           total
//         }
//       }
//       ... on SchemaPublishMissingServiceError
//         @include(if: $includeMissingServiceError) {
//         message
//       }
//     }
//   }
// `);

// const emptyLogger = () => {
//   const logger = {
//     log() {},
//     warn() {},
//     error() {},
//     info() {},
//     debug() {},
//     child() {
//       return logger;
//     },
//   };
//   return {
//     provide: Logger,
//     useValue: logger,
//   };
// };

// function createProviders({
//   organization,
//   project,
//   target,
//   alertsManager,
//   cdnProvider,
// }: {
//   organization: Organization;
//   project: Project;
//   target: Target;
//   alertsManager?: any;
//   cdnProvider?: any;
// }) {
//   return [
//     emptyLogger(),
//     HttpClient,
//     Tracking,
//     {
//       provide: AuthManager,
//       useValue: {
//         ensureApiToken() {
//           return 'api-token';
//         },
//         async ensureOrganizationAccess() {},
//         async ensureProjectAccess() {},
//         async ensureTargetAccess() {},
//       } as Pick<
//         AuthManager,
//         | 'ensureApiToken'
//         | 'ensureOrganizationAccess'
//         | 'ensureProjectAccess'
//         | 'ensureTargetAccess'
//       >,
//     },
//     {
//       provide: OperationsManager,
//       useValue: {},
//     },
//     {
//       provide: AlertsManager,
//       useValue: alertsManager ?? {
//         triggerSchemaChangeNotifications() {},
//       },
//     },
//     {
//       provide: CdnProvider,
//       useValue: cdnProvider ?? {
//         publish() {},
//       },
//     },
//     {
//       provide: OrganizationManager,
//       useValue: {
//         async getOrganization() {
//           return organization;
//         },
//         async getOrganizationIdByToken() {
//           return organization.id;
//         },
//       } as Pick<
//         OrganizationManager,
//         'getOrganization' | 'getOrganizationIdByToken'
//       >,
//     },
//     {
//       provide: ProjectManager,
//       useValue: {
//         async getProject() {
//           return project;
//         },
//         async getProjectIdByToken() {
//           return project.id;
//         },
//       } as Pick<ProjectManager, 'getProject' | 'getProjectIdByToken'>,
//     },
//     {
//       provide: TargetManager,
//       useValue: {
//         async getTarget() {
//           return target;
//         },
//         async getTargetIdByToken() {
//           return target.id;
//         },
//       } as Pick<TargetManager, 'getTarget' | 'getTargetIdByToken'>,
//     },

//     {
//       provide: REDIS_INSTANCE,
//       useFactory() {
//         return new Redis({
//           db: 0,
//           maxRetriesPerRequest: null,
//           enableReadyCheck: false,
//         });
//       },
//     },
//   ];
// }

// // TODO: Move it to integration tests
// describe.skip('publish', () => {
//   test('publish initial schema', async () => {
//     const organization = {
//       id: 'org-id',
//       cleanId: 'ogr-clean-id',
//       name: 'org-name',
//       inviteCode: 'invite',
//       type: OrganizationType.REGULAR,
//     };

//     const project = {
//       id: 'project-id',
//       cleanId: 'project-clean-id',
//       name: 'project-name',
//       type: ProjectType.SINGLE,
//       orgId: organization.id,
//     };

//     const target = {
//       id: 'target-id',
//       cleanId: 'target-clean-id',
//       name: 'target-name',
//       projectId: project.id,
//       orgId: organization.id,
//     };

//     const insertSchema = jest.fn<
//       ReturnType<Storage['insertSchema']>,
//       Parameters<Storage['insertSchema']>
//     >((input) =>
//       Promise.resolve({
//         ...input,
//         id: 'schema-id',
//         source: input.schema,
//         date: new Date().toISOString(),
//         metadata: input.metadata ? JSON.parse(input.metadata) : null,
//       })
//     );

//     const createVersion = jest.fn<
//       ReturnType<Storage['createVersion']>,
//       Parameters<Storage['createVersion']>
//     >((input) =>
//       Promise.resolve({
//         id: 'version-id',
//         date: Date.now(),
//         url: input.url,
//         valid: input.valid,
//         commit: input.commit,
//         base_schema: input.base_schema,
//       })
//     );

//     const input = {
//       author: 'Kamil',
//       commit: 'commit',
//       sdl: 'type Query { foo: String }',
//     };

//     const triggerSchemaChangeNotifications = jest.fn(() => Promise.resolve());
//     const cdnProviderPublish = jest.fn();

//     const mod = testkit.testModule(schemaModule, {
//       replaceExtensions: true,
//       inheritTypeDefs: [sharedModule],
//       providers: [
//         ...createProviders({
//           organization,
//           project,
//           target,
//           alertsManager: { triggerSchemaChangeNotifications },
//           cdnProvider: {
//             publish: cdnProviderPublish,
//           },
//         }),
//         {
//           provide: Storage,
//           useValue: {
//             async getLatestSchemas() {
//               return {
//                 schemas: [],
//               };
//             },
//             async getMaybeSchema() {
//               return null;
//             },
//             async getBaseSchema() {
//               return '';
//             },
//             insertSchema,
//             createVersion,
//           } as Pick<
//             Storage,
//             | 'getLatestSchemas'
//             | 'getMaybeSchema'
//             | 'insertSchema'
//             | 'createVersion'
//             | 'getBaseSchema'
//           >,
//         },
//       ],
//     });

//     const result = await testkit.execute(mod, {
//       document: schemaPublishMutation,
//       variableValues: {
//         input,
//       },
//     });

//     expect(result.errors).not.toBeDefined();

//     // It should insert schema
//     expect(insertSchema).toHaveBeenCalledWith({
//       schema: input.sdl,
//       commit: input.commit,
//       author: input.author,
//       organization: organization.id,
//       project: project.id,
//       target: target.id,
//     });

//     // Create a new version of schema
//     expect(createVersion).toHaveBeenCalledWith({
//       valid: true,
//       commit: 'schema-id',
//       commits: ['schema-id'],
//       organization: organization.id,
//       project: project.id,
//       target: target.id,
//       base_schema: '',
//     });

//     expect(triggerSchemaChangeNotifications).toHaveBeenCalledTimes(1);
//     expect(cdnProviderPublish).toHaveBeenCalledTimes(1);

//     expect(result.data).toEqual({
//       schemaPublish: {
//         __typename: 'SchemaPublishSuccess',
//         initial: true,
//         valid: true,
//         message: null,
//         changes: {
//           nodes: [],
//           total: 0,
//         },
//       },
//     });
//   });

//   test('update service url without db inserts', async () => {
//     const organization = {
//       id: 'org-id',
//       cleanId: 'ogr-clean-id',
//       name: 'org-name',
//       inviteCode: 'invite',
//       type: OrganizationType.REGULAR,
//     };

//     const project = {
//       id: 'project-id',
//       cleanId: 'project-clean-id',
//       name: 'project-name',
//       type: ProjectType.SINGLE,
//       orgId: organization.id,
//     };

//     const target = {
//       id: 'target-id',
//       cleanId: 'target-clean-id',
//       name: 'target-name',
//       projectId: project.id,
//       orgId: organization.id,
//     };

//     const insertSchema = jest.fn(() =>
//       Promise.reject(`You should not be here!`)
//     );

//     const createVersion = jest.fn(() =>
//       Promise.reject(`You should not be here!`)
//     );

//     const updateSchemaUrlOfVersion = jest.fn(async () => {});

//     const input = {
//       author: 'Kamil',
//       commit: 'commit',
//       sdl: 'type Query { foo: String }',
//       url: 'https://api.com',
//       service: 'service',
//     };

//     const triggerSchemaChangeNotifications = jest.fn(() => Promise.resolve());
//     const cdnProviderPublish = jest.fn();

//     const mod = testkit.testModule(schemaModule, {
//       replaceExtensions: true,
//       inheritTypeDefs: [sharedModule],
//       providers: [
//         ...createProviders({
//           organization,
//           project,
//           target,
//           alertsManager: { triggerSchemaChangeNotifications },
//           cdnProvider: {
//             publish: cdnProviderPublish,
//           },
//         }),
//         {
//           provide: Storage,
//           useValue: {
//             async getLatestSchemas() {
//               return {
//                 schemas: [
//                   {
//                     id: 'existing-schema-commit-id',
//                     author: 'existing-author',
//                     commit: 'existing-commit',
//                     source: input.sdl,
//                     service: input.service,
//                     target: 'existing-target',
//                     date: new Date().toISOString(),
//                   },
//                 ],
//                 version: 'existing-version-id',
//               };
//             },
//             async getMaybeSchema() {
//               return null;
//             },
//             async getBaseSchema() {
//               return '';
//             },
//             insertSchema,
//             createVersion,
//             updateSchemaUrlOfVersion,
//           } as Pick<
//             Storage,
//             | 'getLatestSchemas'
//             | 'getMaybeSchema'
//             | 'insertSchema'
//             | 'createVersion'
//             | 'updateSchemaUrlOfVersion'
//             | 'getBaseSchema'
//           >,
//         },
//       ],
//     });

//     const result = await testkit.execute(mod, {
//       document: schemaPublishMutation,
//       variableValues: {
//         input,
//       },
//     });

//     expect(result.errors).not.toBeDefined();

//     // Make sure it doesn't create new version or schema
//     expect(insertSchema).not.toHaveBeenCalled();
//     expect(createVersion).not.toHaveBeenCalled();

//     // No notifications
//     expect(triggerSchemaChangeNotifications).not.toHaveBeenCalled();
//     // Update CDN
//     expect(cdnProviderPublish).toHaveBeenCalledTimes(1);

//     // Make sure it updates the url of the existing version
//     expect(updateSchemaUrlOfVersion).toHaveBeenCalledWith({
//       version: 'existing-version-id',
//       commit: 'existing-schema-commit-id',
//       url: input.url,
//       target: target.id,
//       project: project.id,
//       organization: organization.id,
//     });

//     expect(result.data).toEqual({
//       schemaPublish: {
//         __typename: 'SchemaPublishSuccess',
//         initial: false,
//         valid: true,
//         message: `New service url: ${input.url} (previously: empty)`,
//         changes: {
//           nodes: [],
//           total: 0,
//         },
//       },
//     });
//   });

//   test('do not update service url if exactly the same', async () => {
//     const organization = {
//       id: 'org-id',
//       cleanId: 'ogr-clean-id',
//       name: 'org-name',
//       inviteCode: 'invite',
//       type: OrganizationType.REGULAR,
//     };

//     const project = {
//       id: 'project-id',
//       cleanId: 'project-clean-id',
//       name: 'project-name',
//       type: ProjectType.SINGLE,
//       orgId: organization.id,
//     };

//     const target = {
//       id: 'target-id',
//       cleanId: 'target-clean-id',
//       name: 'target-name',
//       projectId: project.id,
//       orgId: organization.id,
//     };

//     const insertSchema = jest.fn(() =>
//       Promise.reject(`You should not be here!`)
//     );

//     const createVersion = jest.fn(() =>
//       Promise.reject(`You should not be here!`)
//     );

//     const updateSchemaUrlOfVersion = jest.fn(async () => {});

//     const input = {
//       author: 'Kamil',
//       commit: 'commit',
//       sdl: 'type Query { foo: String }',
//       url: 'https://api.com',
//       service: 'service',
//     };

//     const triggerSchemaChangeNotifications = jest.fn(() => Promise.resolve());
//     const cdnProviderPublish = jest.fn();

//     const mod = testkit.testModule(schemaModule, {
//       replaceExtensions: true,
//       inheritTypeDefs: [sharedModule],
//       providers: [
//         ...createProviders({
//           organization,
//           project,
//           target,
//           alertsManager: { triggerSchemaChangeNotifications },
//           cdnProvider: {
//             publish: cdnProviderPublish,
//           },
//         }),
//         {
//           provide: Storage,
//           useValue: {
//             async getLatestSchemas() {
//               return {
//                 schemas: [
//                   {
//                     id: 'existing-schema-commit-id',
//                     author: 'existing-author',
//                     commit: 'existing-commit',
//                     url: input.url,
//                     source: input.sdl,
//                     service: input.service,
//                     target: 'existing-target',
//                     date: new Date().toISOString(),
//                   },
//                 ],
//                 version: 'existing-version-id',
//               };
//             },
//             async getMaybeSchema() {
//               return null;
//             },
//             async getBaseSchema() {
//               return '';
//             },
//             insertSchema,
//             createVersion,
//             updateSchemaUrlOfVersion,
//           } as Pick<
//             Storage,
//             | 'getLatestSchemas'
//             | 'getMaybeSchema'
//             | 'insertSchema'
//             | 'createVersion'
//             | 'updateSchemaUrlOfVersion'
//             | 'getBaseSchema'
//           >,
//         },
//       ],
//     });

//     const result = await testkit.execute(mod, {
//       document: schemaPublishMutation,
//       variableValues: {
//         input,
//       },
//     });

//     // Make sure it doesn't create new version or schema
//     expect(insertSchema).not.toHaveBeenCalled();
//     expect(createVersion).not.toHaveBeenCalled();

//     // No notifications
//     expect(triggerSchemaChangeNotifications).not.toHaveBeenCalled();
//     // No CDN update
//     expect(cdnProviderPublish).not.toHaveBeenCalled();

//     // Do not update if the url is the same
//     expect(updateSchemaUrlOfVersion).not.toHaveBeenCalled();

//     expect(result.errors).not.toBeDefined();
//     expect(result.data).toEqual({
//       schemaPublish: {
//         __typename: 'SchemaPublishSuccess',
//         initial: false,
//         valid: true,
//         message: null,
//         changes: {
//           nodes: [],
//           total: 0,
//         },
//       },
//     });
//   });

//   test('creating root type should not appear as breaking change', async () => {
//     const organization = {
//       id: 'org-id',
//       cleanId: 'ogr-clean-id',
//       name: 'org-name',
//       inviteCode: 'invite',
//       type: OrganizationType.REGULAR,
//     };

//     const project = {
//       id: 'project-id',
//       cleanId: 'project-clean-id',
//       name: 'project-name',
//       type: ProjectType.SINGLE,
//       orgId: organization.id,
//     };

//     const target = {
//       id: 'target-id',
//       cleanId: 'target-clean-id',
//       name: 'target-name',
//       projectId: project.id,
//       orgId: organization.id,
//     };

//     const createVersion = jest.fn();

//     const existingSDL = 'type Query { foo: String }';
//     const input = {
//       author: 'Kamil',
//       commit: 'commit',
//       sdl: `${existingSDL} type Subscription { onFoo: String }`,
//     };

//     const triggerSchemaChangeNotifications = jest.fn(() => Promise.resolve());
//     const cdnProviderPublish = jest.fn();

//     const mod = testkit.testModule(schemaModule, {
//       replaceExtensions: true,
//       inheritTypeDefs: [sharedModule],
//       providers: [
//         ...createProviders({
//           organization,
//           project,
//           target,
//           alertsManager: { triggerSchemaChangeNotifications },
//           cdnProvider: {
//             publish: cdnProviderPublish,
//           },
//         }),
//         {
//           provide: Storage,
//           useValue: {
//             async getLatestSchemas() {
//               return {
//                 schemas: [
//                   {
//                     id: 'existing-schema-commit-id',
//                     author: 'existing-author',
//                     commit: 'existing-commit',
//                     source: existingSDL,
//                     date: new Date().toISOString(),
//                     target: 'existing-target',
//                   },
//                 ],
//                 version: 'existing-version-id',
//               };
//             },
//             async getMaybeSchema() {
//               return null;
//             },
//             async getBaseSchema() {
//               return '';
//             },
//             async insertSchema(obj) {
//               return {
//                 id: 'new-schema-commit-id',
//                 author: obj.author,
//                 commit: obj.commit,
//                 source: obj.schema,
//                 target: obj.target,
//                 date: new Date().toISOString(),
//               };
//             },
//             createVersion,
//           } as Pick<
//             Storage,
//             | 'getLatestSchemas'
//             | 'getMaybeSchema'
//             | 'insertSchema'
//             | 'createVersion'
//             | 'getBaseSchema'
//           >,
//         },
//       ],
//     });

//     const result = await testkit.execute(mod, {
//       document: schemaPublishMutation,
//       variableValues: {
//         input,
//       },
//     });

//     expect(result.errors).not.toBeDefined();

//     expect(triggerSchemaChangeNotifications).toHaveBeenCalledTimes(1);
//     expect(cdnProviderPublish).toHaveBeenCalledTimes(1);

//     expect(result.data).toEqual({
//       schemaPublish: {
//         __typename: 'SchemaPublishSuccess',
//         initial: false,
//         message: null,
//         valid: true,
//         changes: {
//           nodes: [
//             {
//               criticality: 'Safe',
//               path: ['Subscription'],
//             },
//           ],
//           total: 1,
//         },
//       },
//     });
//   });

//   test('can not update stitching project without specified service input if SchemaPublishMissingServiceError is selected', async () => {
//     const organization = {
//       id: 'org-id',
//       cleanId: 'ogr-clean-id',
//       name: 'org-name',
//       inviteCode: 'invite',
//       type: OrganizationType.REGULAR,
//     };

//     const project = {
//       id: 'project-id',
//       cleanId: 'project-clean-id',
//       name: 'project-name',
//       type: ProjectType.STITCHING,
//       orgId: organization.id,
//     };

//     const target = {
//       id: 'target-id',
//       cleanId: 'target-clean-id',
//       name: 'target-name',
//       projectId: project.id,
//       orgId: organization.id,
//     };

//     const createVersion = jest.fn();

//     const mod = testkit.testModule(schemaModule, {
//       replaceExtensions: true,
//       inheritTypeDefs: [sharedModule],
//       providers: [
//         ...createProviders({
//           organization,
//           project,
//           target,
//         }),
//         {
//           provide: Storage,
//           useValue: {
//             async getLatestSchemas() {
//               return {
//                 schemas: [],
//               };
//             },
//             async getMaybeSchema() {
//               return null;
//             },
//             async getBaseSchema() {
//               return null;
//             },
//             async insertSchema(obj) {
//               return {
//                 id: 'new-schema-commit-id',
//                 author: obj.author,
//                 commit: obj.commit,
//                 source: obj.schema,
//                 target: obj.target,
//                 date: new Date().toISOString(),
//               };
//             },
//             createVersion,
//           } as Pick<
//             Storage,
//             | 'getLatestSchemas'
//             | 'getMaybeSchema'
//             | 'insertSchema'
//             | 'createVersion'
//           >,
//         },
//       ],
//     });

//     const input = {
//       author: 'n1',
//       commit: 'commit',
//       sdl: `type Subscription { onFoo: String }`,
//     };

//     const result = await testkit.execute(mod, {
//       document: schemaPublishMutation,
//       variableValues: {
//         input,
//         includeMissingServiceError: true,
//       },
//     });

//     expect(result.data).toBeDefined();
//     expect(result.errors).toBeUndefined();

//     expect(result.data?.schemaPublish).toEqual({
//       __typename: 'SchemaPublishMissingServiceError',
//       message:
//         'Can not publish schema for a stitching project without a service name.',
//     });
//   });

//   test('can not update federation project without specified service input if SchemaPublishMissingServiceError is selected', async () => {
//     const organization = {
//       id: 'org-id',
//       cleanId: 'ogr-clean-id',
//       name: 'org-name',
//       inviteCode: 'invite',
//       type: OrganizationType.REGULAR,
//     };

//     const project = {
//       id: 'project-id',
//       cleanId: 'project-clean-id',
//       name: 'project-name',
//       type: ProjectType.FEDERATION,
//       orgId: organization.id,
//     };

//     const target = {
//       id: 'target-id',
//       cleanId: 'target-clean-id',
//       name: 'target-name',
//       projectId: project.id,
//       orgId: organization.id,
//     };

//     const createVersion = jest.fn();

//     const mod = testkit.testModule(schemaModule, {
//       replaceExtensions: true,
//       inheritTypeDefs: [sharedModule],
//       providers: [
//         ...createProviders({
//           organization,
//           project,
//           target,
//         }),
//         {
//           provide: Storage,
//           useValue: {
//             async getLatestSchemas() {
//               return {
//                 schemas: [],
//               };
//             },
//             async getMaybeSchema() {
//               return null;
//             },
//             async getBaseSchema() {
//               return null;
//             },
//             async insertSchema(obj) {
//               return {
//                 id: 'new-schema-commit-id',
//                 author: obj.author,
//                 commit: obj.commit,
//                 source: obj.schema,
//                 target: obj.target,
//                 date: new Date().toISOString(),
//               };
//             },
//             createVersion,
//           } as Pick<
//             Storage,
//             | 'getLatestSchemas'
//             | 'getMaybeSchema'
//             | 'insertSchema'
//             | 'createVersion'
//           >,
//         },
//       ],
//     });

//     const input = {
//       author: 'Kamil',
//       commit: 'commit',
//       sdl: `type Subscription { onFoo: String }`,
//     };

//     const result = await testkit.execute(mod, {
//       document: schemaPublishMutation,
//       variableValues: {
//         input,
//         includeMissingServiceError: true,
//       },
//     });

//     expect(result.data).toBeDefined();
//     expect(result.errors).toBeUndefined();

//     expect(result.data?.schemaPublish).toEqual({
//       __typename: 'SchemaPublishMissingServiceError',
//       message:
//         'Can not publish schema for a federation project without a service name.',
//     });
//   });
// });
