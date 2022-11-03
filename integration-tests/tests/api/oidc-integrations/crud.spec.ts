import { gql } from '@app/gql';
import { authenticate } from '../../../testkit/auth';
import { createOrganization } from '../../../testkit/flow';
import { execute } from '../../../testkit/graphql';

const OrganizationWithOIDCIntegration = gql(/* GraphQL */ `
  query OrganizationWithOIDCIntegration($organizationId: ID!) {
    organization(selector: { organization: $organizationId }) {
      organization {
        id
        oidcIntegration {
          id
        }
      }
    }
  }
`);

const CreateOIDCIntegrationMutation = gql(/* GraphQL */ `
  mutation CreateOIDCIntegrationMutation($input: CreateOIDCIntegrationInput!) {
    createOIDCIntegration(input: $input) {
      ok {
        createdOIDCIntegration {
          id
          clientId
          clientSecretPreview
          oauthApiUrl
        }
      }
      error {
        message
        details {
          clientId
          clientSecret
          oauthApiUrl
        }
      }
    }
  }
`);

describe('create', () => {
  describe('permissions="organization:integrations"', () => {
    test('success', async () => {
      const { access_token } = await authenticate('main');
      const orgResult = await createOrganization(
        {
          name: 'foo',
        },
        access_token
      );

      const org = orgResult.body.data!.createOrganization.ok!.createdOrganizationPayload.organization;

      const result = await execute({
        document: CreateOIDCIntegrationMutation,
        variables: {
          input: {
            organizationId: org.id,
            clientId: 'foo',
            clientSecret: 'foofoofoofoo',
            oauthApiUrl: 'http://localhost:8888/oauth',
          },
        },
        authToken: access_token,
      });

      expect(result.body.errors).toBeUndefined();
      expect(result.body.data).toEqual({
        createOIDCIntegration: {
          error: null,
          ok: {
            createdOIDCIntegration: {
              id: expect.any(String),
              clientId: 'foo',
              clientSecretPreview: 'ofoo',
              oauthApiUrl: 'http://localhost:8888/oauth',
            },
          },
        },
      });

      const refetchedOrg = await execute({
        document: OrganizationWithOIDCIntegration,
        variables: {
          organizationId: org.cleanId,
        },
        authToken: access_token,
      });

      expect(refetchedOrg.body.errors).toBeUndefined();
      expect(refetchedOrg.body.data).toEqual({
        organization: {
          organization: {
            id: org.id,
            oidcIntegration: {
              id: result.body.data!.createOIDCIntegration.ok!.createdOIDCIntegration.id,
            },
          },
        },
      });
    });

    test('error: non existing organization', async () => {
      const { access_token } = await authenticate('main');
      const result = await execute({
        document: CreateOIDCIntegrationMutation,
        variables: {
          input: {
            organizationId: 'i-do-not-exist',
            clientId: 'fo',
            clientSecret: 'foofoofoofoo',
            oauthApiUrl: 'http://localhost:8888/oauth',
          },
        },
        authToken: access_token,
      });

      expect(result.body.errors).toMatchInlineSnapshot(`
        [
          {
            "locations": [
              {
                "column": 3,
                "line": 2,
              },
            ],
            "message": "No access (reason: "Missing organization:integrations permission")",
            "path": [
              "createOIDCIntegration",
            ],
          },
        ]
      `);
    });
    test('error: too short clientId', async () => {
      const { access_token } = await authenticate('main');
      const orgResult = await createOrganization(
        {
          name: 'foo',
        },
        access_token
      );

      const org = orgResult.body.data!.createOrganization.ok!.createdOrganizationPayload.organization;

      const result = await execute({
        document: CreateOIDCIntegrationMutation,
        variables: {
          input: {
            organizationId: org.id,
            clientId: 'fo',
            clientSecret: 'foofoofoofoo',
            oauthApiUrl: 'http://localhost:8888/oauth',
          },
        },
        authToken: access_token,
      });

      expect(result.body.errors).toBeUndefined();
      expect(result.body.data).toMatchInlineSnapshot(`
        {
          "createOIDCIntegration": {
            "error": {
              "details": {
                "clientId": "Must be at least 3 characters long.",
                "clientSecret": null,
                "oauthApiUrl": null,
              },
              "message": "Failed to create OIDC Integration.",
            },
            "ok": null,
          },
        }
      `);
    });
    test('error: too long clientId', async () => {
      const { access_token } = await authenticate('main');
      const orgResult = await createOrganization(
        {
          name: 'foo',
        },
        access_token
      );

      const org = orgResult.body.data!.createOrganization.ok!.createdOrganizationPayload.organization;

      const result = await execute({
        document: CreateOIDCIntegrationMutation,
        variables: {
          input: {
            organizationId: org.id,
            clientId: new Array(101).fill('a').join(''),
            clientSecret: 'foofoofoofoo',
            oauthApiUrl: 'http://localhost:8888/oauth',
          },
        },
        authToken: access_token,
      });

      expect(result.body.errors).toBeUndefined();
      expect(result.body.data).toMatchInlineSnapshot(`
        {
          "createOIDCIntegration": {
            "error": {
              "details": {
                "clientId": "Can not be longer than 100 characters.",
                "clientSecret": null,
                "oauthApiUrl": null,
              },
              "message": "Failed to create OIDC Integration.",
            },
            "ok": null,
          },
        }
      `);
    });
    test('error: too short clientSecret', async () => {
      const { access_token } = await authenticate('main');
      const orgResult = await createOrganization(
        {
          name: 'foo',
        },
        access_token
      );

      const org = orgResult.body.data!.createOrganization.ok!.createdOrganizationPayload.organization;

      const result = await execute({
        document: CreateOIDCIntegrationMutation,
        variables: {
          input: {
            organizationId: org.id,
            clientId: 'foo',
            clientSecret: 'fo',
            oauthApiUrl: 'http://localhost:8888/oauth',
          },
        },
        authToken: access_token,
      });

      expect(result.body.errors).toBeUndefined();
      expect(result.body.data).toMatchInlineSnapshot(`
        {
          "createOIDCIntegration": {
            "error": {
              "details": {
                "clientId": null,
                "clientSecret": "Must be at least 3 characters long.",
                "oauthApiUrl": null,
              },
              "message": "Failed to create OIDC Integration.",
            },
            "ok": null,
          },
        }
      `);
    });
    test('error: too long clientSecret', async () => {
      const { access_token } = await authenticate('main');
      const orgResult = await createOrganization(
        {
          name: 'foo',
        },
        access_token
      );

      const org = orgResult.body.data!.createOrganization.ok!.createdOrganizationPayload.organization;

      const result = await execute({
        document: CreateOIDCIntegrationMutation,
        variables: {
          input: {
            organizationId: org.id,
            clientId: 'foo',
            clientSecret: new Array(500).fill('a').join(''),
            oauthApiUrl: 'http://localhost:8888/oauth',
          },
        },
        authToken: access_token,
      });

      expect(result.body.errors).toBeUndefined();
      expect(result.body.data).toMatchInlineSnapshot(`
        {
          "createOIDCIntegration": {
            "error": {
              "details": {
                "clientId": null,
                "clientSecret": "Can not be longer than 200 characters.",
                "oauthApiUrl": null,
              },
              "message": "Failed to create OIDC Integration.",
            },
            "ok": null,
          },
        }
      `);
    });
    test('error: invalid oauth api url', async () => {
      const { access_token } = await authenticate('main');
      const orgResult = await createOrganization(
        {
          name: 'foo',
        },
        access_token
      );

      const org = orgResult.body.data!.createOrganization.ok!.createdOrganizationPayload.organization;

      const result = await execute({
        document: CreateOIDCIntegrationMutation,
        variables: {
          input: {
            organizationId: org.id,
            clientId: 'foo',
            clientSecret: 'foo',
            oauthApiUrl: 'foo',
          },
        },
        authToken: access_token,
      });

      expect(result.body.errors).toBeUndefined();
      expect(result.body.data).toMatchInlineSnapshot(`
        {
          "createOIDCIntegration": {
            "error": {
              "details": {
                "clientId": null,
                "clientSecret": null,
                "oauthApiUrl": "Must be a valid OAuth API url.",
              },
              "message": "Failed to create OIDC Integration.",
            },
            "ok": null,
          },
        }
      `);
    });
    test('error: multiple integrations per organization', async () => {
      const { access_token } = await authenticate('main');
      const orgResult = await createOrganization(
        {
          name: 'foo',
        },
        access_token
      );

      const org = orgResult.body.data!.createOrganization.ok!.createdOrganizationPayload.organization;

      let result = await execute({
        document: CreateOIDCIntegrationMutation,
        variables: {
          input: {
            organizationId: org.id,
            clientId: 'foo',
            clientSecret: 'foofoofoofoo',
            oauthApiUrl: 'http://localhost:8888/oauth',
          },
        },
        authToken: access_token,
      });

      expect(result.body.errors).toBeUndefined();
      expect(result.body.data).toEqual({
        createOIDCIntegration: {
          error: null,
          ok: {
            createdOIDCIntegration: {
              id: expect.any(String),
              clientId: 'foo',
              clientSecretPreview: 'ofoo',
              oauthApiUrl: 'http://localhost:8888/oauth',
            },
          },
        },
      });

      result = await execute({
        document: CreateOIDCIntegrationMutation,
        variables: {
          input: {
            organizationId: org.id,
            clientId: 'foo',
            clientSecret: 'foofoofoofoo',
            oauthApiUrl: 'http://localhost:8888/oauth',
          },
        },
        authToken: access_token,
      });

      expect(result.body.errors).toBeUndefined();
      expect(result.body.data).toEqual({
        createOIDCIntegration: {
          error: {
            message: 'An OIDC integration already exists for this organization.',
            details: {
              clientId: null,
              clientSecret: null,
              oauthApiUrl: null,
            },
          },
          ok: null,
        },
      });
    });
  });
});

const DeleteOIDCIntegrationMutation = gql(/* GraphQL */ `
  mutation DeleteOIDCIntegrationMutation($input: DeleteOIDCIntegrationInput!) {
    deleteOIDCIntegration(input: $input) {
      ok {
        __typename
      }
      error {
        message
      }
    }
  }
`);

describe('delete', () => {
  describe('permissions="organization:integrations"', () => {
    test('success', async () => {
      const { access_token } = await authenticate('main');
      const orgResult = await createOrganization(
        {
          name: 'foo',
        },
        access_token
      );

      const org = orgResult.body.data!.createOrganization.ok!.createdOrganizationPayload.organization;

      const createResult = await execute({
        document: CreateOIDCIntegrationMutation,
        variables: {
          input: {
            organizationId: org.id,
            clientId: 'foo',
            clientSecret: 'foofoofoofoo',
            oauthApiUrl: 'http://localhost:8888/oauth',
          },
        },
        authToken: access_token,
      });

      expect(createResult.body.errors).toBeUndefined();
      const oidcIntegrationId = createResult.body.data!.createOIDCIntegration.ok!.createdOIDCIntegration.id;

      let refetchedOrg = await execute({
        document: OrganizationWithOIDCIntegration,
        variables: {
          organizationId: org.cleanId,
        },
        authToken: access_token,
      });

      expect(refetchedOrg.body.errors).toBeUndefined();
      expect(refetchedOrg.body.data).toEqual({
        organization: {
          organization: {
            id: org.id,
            oidcIntegration: {
              id: oidcIntegrationId,
            },
          },
        },
      });

      const deleteResult = await execute({
        document: DeleteOIDCIntegrationMutation,
        variables: {
          input: {
            oidcIntegrationId,
          },
        },
        authToken: access_token,
      });

      expect(deleteResult.body.errors).toBeUndefined();
      expect(deleteResult).toMatchInlineSnapshot(`
        {
          "body": {
            "data": {
              "deleteOIDCIntegration": {
                "error": null,
                "ok": {
                  "__typename": "DeleteOIDCIntegrationOk",
                },
              },
            },
          },
          "status": 200,
        }
      `);

      refetchedOrg = await execute({
        document: OrganizationWithOIDCIntegration,
        variables: {
          organizationId: org.cleanId,
        },
        authToken: access_token,
      });

      expect(refetchedOrg.body.errors).toBeUndefined();
      expect(refetchedOrg.body.data).toEqual({
        organization: {
          organization: {
            id: org.id,
            oidcIntegration: null,
          },
        },
      });
    });

    test("error: user doesn't have permissions", async () => {
      const { access_token } = await authenticate('main');
      const orgResult = await createOrganization(
        {
          name: 'foo',
        },
        access_token
      );

      const org = orgResult.body.data!.createOrganization.ok!.createdOrganizationPayload.organization;

      const createResult = await execute({
        document: CreateOIDCIntegrationMutation,
        variables: {
          input: {
            organizationId: org.id,
            clientId: 'foo',
            clientSecret: 'foofoofoofoo',
            oauthApiUrl: 'http://localhost:8888/oauth',
          },
        },
        authToken: access_token,
      });

      expect(createResult.body.errors).toBeUndefined();
      const oidcIntegrationId = createResult.body.data!.createOIDCIntegration.ok!.createdOIDCIntegration.id;

      const { access_token: accessTokenExtra } = await authenticate('extra');

      const deleteResult = await execute({
        document: DeleteOIDCIntegrationMutation,
        variables: {
          input: {
            oidcIntegrationId,
          },
        },
        authToken: accessTokenExtra,
      });

      expect(deleteResult.body.errors).toBeDefined();
      expect(deleteResult.body.errors).toMatchInlineSnapshot(`
        [
          {
            "locations": [
              {
                "column": 3,
                "line": 2,
              },
            ],
            "message": "No access (reason: "Missing organization:integrations permission")",
            "path": [
              "deleteOIDCIntegration",
            ],
          },
        ]
      `);
    });

    test('success: upon integration deletion oidc members are also deleted', async () => {
      const { access_token } = await authenticate('main');
      const orgResult = await createOrganization(
        {
          name: 'foo',
        },
        access_token
      );

      const org = orgResult.body.data!.createOrganization.ok!.createdOrganizationPayload.organization;

      const createResult = await execute({
        document: CreateOIDCIntegrationMutation,
        variables: {
          input: {
            organizationId: org.id,
            clientId: 'foo',
            clientSecret: 'foofoofoofoo',
            oauthApiUrl: 'http://localhost:8888/oauth',
          },
        },
        authToken: access_token,
      });

      expect(createResult.body.errors).toBeUndefined();
      const oidcIntegrationId = createResult.body.data!.createOIDCIntegration.ok!.createdOIDCIntegration.id;

      const MeQuery = gql(/* GraphQL */ `
        query Me {
          me {
            id
          }
        }
      `);

      // create new member that belongs to oidc integration
      const { access_token: memberAccessToken } = await authenticate('oidc_member', oidcIntegrationId);
      let meResult = await execute({
        document: MeQuery,
        authToken: memberAccessToken,
      });

      expect(meResult.body.errors).toBeUndefined();
      expect(meResult.body.data).toEqual({
        me: {
          id: expect.any(String),
        },
      });

      const deleteResult = await execute({
        document: DeleteOIDCIntegrationMutation,
        variables: {
          input: {
            oidcIntegrationId,
          },
        },
        authToken: access_token,
      });

      expect(deleteResult.body.errors).toBeUndefined();

      meResult = await execute({
        document: MeQuery,
        authToken: memberAccessToken,
      });

      expect(meResult.body).toMatchInlineSnapshot(`
        {
          "data": null,
          "errors": [
            {
              "locations": [
                {
                  "column": 3,
                  "line": 2,
                },
              ],
              "message": "No access (reason: "User not found")",
              "path": [
                "me",
              ],
            },
          ],
        }
      `);
    });
  });
});

const UpdateOIDCIntegrationMutation = gql(/* GraphQL */ `
  mutation UpdateOIDCIntegrationMutation($input: UpdateOIDCIntegrationInput!) {
    updateOIDCIntegration(input: $input) {
      ok {
        updatedOIDCIntegration {
          id
          oauthApiUrl
          clientId
          clientSecretPreview
        }
      }
      error {
        message
        details {
          clientId
          clientSecret
          oauthApiUrl
        }
      }
    }
  }
`);

describe('update', () => {
  describe('permissions="organization:integrations"', () => {
    test('success', async () => {
      const { access_token } = await authenticate('main');
      const orgResult = await createOrganization(
        {
          name: 'foo',
        },
        access_token
      );

      const org = orgResult.body.data!.createOrganization.ok!.createdOrganizationPayload.organization;

      const createResult = await execute({
        document: CreateOIDCIntegrationMutation,
        variables: {
          input: {
            organizationId: org.id,
            clientId: 'aaaa',
            clientSecret: 'aaaaaaaaaaaa',
            oauthApiUrl: 'http://localhost:8888/aaaa',
          },
        },
        authToken: access_token,
      });
      expect(createResult.body.errors).toBeUndefined();

      const oidcIntegrationId = createResult.body.data!.createOIDCIntegration.ok!.createdOIDCIntegration.id;

      const updateResult = await execute({
        document: UpdateOIDCIntegrationMutation,
        variables: {
          input: {
            oidcIntegrationId: oidcIntegrationId,
            clientId: 'bbbb',
            clientSecret: 'bbbbbbbbbbbb',
            oauthApiUrl: 'http://localhost:8888/bbbb',
          },
        },
        authToken: access_token,
      });

      expect(updateResult.body.errors).toBeUndefined();
      expect(updateResult.body.data).toEqual({
        updateOIDCIntegration: {
          error: null,
          ok: {
            updatedOIDCIntegration: {
              id: oidcIntegrationId,
              clientId: 'bbbb',
              clientSecretPreview: 'bbbb',
              oauthApiUrl: 'http://localhost:8888/bbbb',
            },
          },
        },
      });
    });
    test('error: user does not have permissions', async () => {
      const { access_token } = await authenticate('main');
      const orgResult = await createOrganization(
        {
          name: 'foo',
        },
        access_token
      );

      const org = orgResult.body.data!.createOrganization.ok!.createdOrganizationPayload.organization;

      const createResult = await execute({
        document: CreateOIDCIntegrationMutation,
        variables: {
          input: {
            organizationId: org.id,
            clientId: 'foo',
            clientSecret: 'foofoofoofoo',
            oauthApiUrl: 'http://localhost:8888/oauth',
          },
        },
        authToken: access_token,
      });

      expect(createResult.body.errors).toBeUndefined();
      const oidcIntegrationId = createResult.body.data!.createOIDCIntegration.ok!.createdOIDCIntegration.id;

      const { access_token: accessTokenExtra } = await authenticate('extra');

      const deleteResult = await execute({
        document: UpdateOIDCIntegrationMutation,
        variables: {
          input: {
            oidcIntegrationId,
          },
        },
        authToken: accessTokenExtra,
      });

      expect(deleteResult.body.errors).toBeDefined();
      expect(deleteResult.body.errors).toMatchInlineSnapshot(`
        [
          {
            "locations": [
              {
                "column": 3,
                "line": 2,
              },
            ],
            "message": "No access (reason: "Missing organization:integrations permission")",
            "path": [
              "updateOIDCIntegration",
            ],
          },
        ]
      `);
    });
  });
});
