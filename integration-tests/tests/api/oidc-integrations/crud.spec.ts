import { graphql } from '../../../testkit/gql';
import { execute } from '../../../testkit/graphql';
import { initSeed } from '../../../testkit/seed';

const OrganizationWithOIDCIntegration = graphql(`
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

const CreateOIDCIntegrationMutation = graphql(`
  mutation CreateOIDCIntegrationMutation($input: CreateOIDCIntegrationInput!) {
    createOIDCIntegration(input: $input) {
      ok {
        createdOIDCIntegration {
          id
          clientId
          clientSecretPreview
          tokenEndpoint
          userinfoEndpoint
          authorizationEndpoint
        }
      }
      error {
        message
        details {
          clientId
          clientSecret
          tokenEndpoint
          userinfoEndpoint
          authorizationEndpoint
        }
      }
    }
  }
`);

describe('create', () => {
  describe('permissions="organization:integrations"', () => {
    test.concurrent('success', async () => {
      const { ownerToken, createOrg } = await initSeed().createOwner();
      const { organization } = await createOrg();

      const result = await execute({
        document: CreateOIDCIntegrationMutation,
        variables: {
          input: {
            organizationId: organization.id,
            clientId: 'foo',
            clientSecret: 'foofoofoofoo',
            tokenEndpoint: 'http://localhost:8888/oauth/token',
            userinfoEndpoint: 'http://localhost:8888/oauth/userinfo',
            authorizationEndpoint: 'http://localhost:8888/oauth/authorize',
          },
        },
        authToken: ownerToken,
      }).then(r => r.expectNoGraphQLErrors());

      expect(result).toEqual({
        createOIDCIntegration: {
          error: null,
          ok: {
            createdOIDCIntegration: {
              id: expect.any(String),
              clientId: 'foo',
              clientSecretPreview: 'ofoo',
              tokenEndpoint: 'http://localhost:8888/oauth/token',
              userinfoEndpoint: 'http://localhost:8888/oauth/userinfo',
              authorizationEndpoint: 'http://localhost:8888/oauth/authorize',
            },
          },
        },
      });

      const refetchedOrg = await execute({
        document: OrganizationWithOIDCIntegration,
        variables: {
          organizationId: organization.cleanId,
        },
        authToken: ownerToken,
      }).then(r => r.expectNoGraphQLErrors());

      expect(refetchedOrg).toEqual({
        organization: {
          organization: {
            id: organization.id,
            oidcIntegration: {
              id: result.createOIDCIntegration.ok!.createdOIDCIntegration.id,
            },
          },
        },
      });
    });

    test.concurrent('error: non existing organization', async ({ expect }) => {
      const { ownerToken } = await initSeed().createOwner();
      const errors = await execute({
        document: CreateOIDCIntegrationMutation,
        variables: {
          input: {
            organizationId: 'i-do-not-exist',
            clientId: 'fo',
            clientSecret: 'foofoofoofoo',
            tokenEndpoint: 'http://localhost:8888/oauth/token',
            userinfoEndpoint: 'http://localhost:8888/oauth/userinfo',
            authorizationEndpoint: 'http://localhost:8888/oauth/authorize',
          },
        },
        authToken: ownerToken,
      }).then(r => r.expectGraphQLErrors());

      expect(errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            message: `No access (reason: "Missing organization:integrations permission")`,
          }),
        ]),
      );
    });

    test.concurrent('error: too short clientId', async ({ expect }) => {
      const { ownerToken, createOrg } = await initSeed().createOwner();
      const { organization } = await createOrg();

      const result = await execute({
        document: CreateOIDCIntegrationMutation,
        variables: {
          input: {
            organizationId: organization.id,
            clientId: 'fo',
            clientSecret: 'foofoofoofoo',
            tokenEndpoint: 'http://localhost:8888/oauth/token',
            userinfoEndpoint: 'http://localhost:8888/oauth/userinfo',
            authorizationEndpoint: 'http://localhost:8888/oauth/authorize',
          },
        },
        authToken: ownerToken,
      }).then(r => r.expectNoGraphQLErrors());

      expect(result).toMatchInlineSnapshot(`
        {
          createOIDCIntegration: {
            error: {
              details: {
                authorizationEndpoint: null,
                clientId: Must be at least 3 characters long.,
                clientSecret: null,
                tokenEndpoint: null,
                userinfoEndpoint: null,
              },
              message: Failed to create OIDC Integration.,
            },
            ok: null,
          },
        }
      `);
    });

    test.concurrent('error: too long clientId', async ({ expect }) => {
      const { ownerToken, createOrg } = await initSeed().createOwner();
      const { organization } = await createOrg();

      const result = await execute({
        document: CreateOIDCIntegrationMutation,
        variables: {
          input: {
            organizationId: organization.id,
            clientId: new Array(101).fill('a').join(''),
            clientSecret: 'foofoofoofoo',
            tokenEndpoint: 'http://localhost:8888/oauth/token',
            userinfoEndpoint: 'http://localhost:8888/oauth/userinfo',
            authorizationEndpoint: 'http://localhost:8888/oauth/authorize',
          },
        },
        authToken: ownerToken,
      }).then(r => r.expectNoGraphQLErrors());

      expect(result).toMatchInlineSnapshot(`
        {
          createOIDCIntegration: {
            error: {
              details: {
                authorizationEndpoint: null,
                clientId: Can not be longer than 100 characters.,
                clientSecret: null,
                tokenEndpoint: null,
                userinfoEndpoint: null,
              },
              message: Failed to create OIDC Integration.,
            },
            ok: null,
          },
        }
      `);
    });

    test.concurrent('error: too short clientSecret', async ({ expect }) => {
      const { ownerToken, createOrg } = await initSeed().createOwner();
      const { organization } = await createOrg();

      const result = await execute({
        document: CreateOIDCIntegrationMutation,
        variables: {
          input: {
            organizationId: organization.id,
            clientId: 'foo',
            clientSecret: 'fo',
            tokenEndpoint: 'http://localhost:8888/oauth/token',
            userinfoEndpoint: 'http://localhost:8888/oauth/userinfo',
            authorizationEndpoint: 'http://localhost:8888/oauth/authorize',
          },
        },
        authToken: ownerToken,
      }).then(r => r.expectNoGraphQLErrors());

      expect(result).toMatchInlineSnapshot(`
        {
          createOIDCIntegration: {
            error: {
              details: {
                authorizationEndpoint: null,
                clientId: null,
                clientSecret: Must be at least 3 characters long.,
                tokenEndpoint: null,
                userinfoEndpoint: null,
              },
              message: Failed to create OIDC Integration.,
            },
            ok: null,
          },
        }
      `);
    });

    test.concurrent('error: too long clientSecret', async ({ expect }) => {
      const { ownerToken, createOrg } = await initSeed().createOwner();
      const { organization } = await createOrg();

      const result = await execute({
        document: CreateOIDCIntegrationMutation,
        variables: {
          input: {
            organizationId: organization.id,
            clientId: 'foo',
            clientSecret: new Array(500).fill('a').join(''),
            tokenEndpoint: 'http://localhost:8888/oauth/token',
            userinfoEndpoint: 'http://localhost:8888/oauth/userinfo',
            authorizationEndpoint: 'http://localhost:8888/oauth/authorize',
          },
        },
        authToken: ownerToken,
      }).then(r => r.expectNoGraphQLErrors());

      expect(result).toMatchInlineSnapshot(`
        {
          createOIDCIntegration: {
            error: {
              details: {
                authorizationEndpoint: null,
                clientId: null,
                clientSecret: Can not be longer than 200 characters.,
                tokenEndpoint: null,
                userinfoEndpoint: null,
              },
              message: Failed to create OIDC Integration.,
            },
            ok: null,
          },
        }
      `);
    });

    test.concurrent('error: invalid oauth api url', async ({ expect }) => {
      const { ownerToken, createOrg } = await initSeed().createOwner();
      const { organization } = await createOrg();

      const result = await execute({
        document: CreateOIDCIntegrationMutation,
        variables: {
          input: {
            organizationId: organization.id,
            clientId: 'foo',
            clientSecret: 'foo',
            tokenEndpoint: 'foo',
            userinfoEndpoint: 'foo',
            authorizationEndpoint: 'foo',
          },
        },
        authToken: ownerToken,
      }).then(r => r.expectNoGraphQLErrors());

      expect(result).toMatchInlineSnapshot(`
        {
          createOIDCIntegration: {
            error: {
              details: {
                authorizationEndpoint: Must be a valid OAuth API url.,
                clientId: null,
                clientSecret: null,
                tokenEndpoint: Must be a valid OAuth API url.,
                userinfoEndpoint: Must be a valid OAuth API url.,
              },
              message: Failed to create OIDC Integration.,
            },
            ok: null,
          },
        }
      `);
    });

    test.concurrent('error: multiple integrations per organization', async () => {
      const { ownerToken, createOrg } = await initSeed().createOwner();
      const { organization } = await createOrg();

      const result = await execute({
        document: CreateOIDCIntegrationMutation,
        variables: {
          input: {
            organizationId: organization.id,
            clientId: 'foo',
            clientSecret: 'foofoofoofoo',
            tokenEndpoint: 'http://localhost:8888/oauth/token',
            userinfoEndpoint: 'http://localhost:8888/oauth/userinfo',
            authorizationEndpoint: 'http://localhost:8888/oauth/authorize',
          },
        },
        authToken: ownerToken,
      }).then(r => r.expectNoGraphQLErrors());

      expect(result).toEqual({
        createOIDCIntegration: {
          error: null,
          ok: {
            createdOIDCIntegration: {
              id: expect.any(String),
              clientId: 'foo',
              clientSecretPreview: 'ofoo',
              tokenEndpoint: 'http://localhost:8888/oauth/token',
              userinfoEndpoint: 'http://localhost:8888/oauth/userinfo',
              authorizationEndpoint: 'http://localhost:8888/oauth/authorize',
            },
          },
        },
      });

      const result2 = await execute({
        document: CreateOIDCIntegrationMutation,
        variables: {
          input: {
            organizationId: organization.id,
            clientId: 'foo',
            clientSecret: 'foofoofoofoo',
            tokenEndpoint: 'http://localhost:8888/oauth/token',
            userinfoEndpoint: 'http://localhost:8888/oauth/userinfo',
            authorizationEndpoint: 'http://localhost:8888/oauth/authorize',
          },
        },
        authToken: ownerToken,
      }).then(r => r.expectNoGraphQLErrors());

      expect(result2).toEqual({
        createOIDCIntegration: {
          error: {
            message: 'An OIDC integration already exists for this organization.',
            details: {
              clientId: null,
              clientSecret: null,
              tokenEndpoint: null,
              userinfoEndpoint: null,
              authorizationEndpoint: null,
            },
          },
          ok: null,
        },
      });
    });
  });
});

const DeleteOIDCIntegrationMutation = graphql(`
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
    test.concurrent('success', async () => {
      const { ownerToken, createOrg } = await initSeed().createOwner();
      const { organization } = await createOrg();

      const createResult = await execute({
        document: CreateOIDCIntegrationMutation,
        variables: {
          input: {
            organizationId: organization.id,
            clientId: 'foo',
            clientSecret: 'foofoofoofoo',
            tokenEndpoint: 'http://localhost:8888/oauth/token',
            userinfoEndpoint: 'http://localhost:8888/oauth/userinfo',
            authorizationEndpoint: 'http://localhost:8888/oauth/authorize',
          },
        },
        authToken: ownerToken,
      }).then(r => r.expectNoGraphQLErrors());

      const oidcIntegrationId = createResult.createOIDCIntegration.ok!.createdOIDCIntegration.id;

      let refetchedOrg = await execute({
        document: OrganizationWithOIDCIntegration,
        variables: {
          organizationId: organization.cleanId,
        },
        authToken: ownerToken,
      }).then(r => r.expectNoGraphQLErrors());

      expect(refetchedOrg).toEqual({
        organization: {
          organization: {
            id: organization.id,
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
        authToken: ownerToken,
      }).then(r => r.expectNoGraphQLErrors());

      expect(deleteResult).toEqual({
        deleteOIDCIntegration: {
          error: null,
          ok: {
            __typename: 'DeleteOIDCIntegrationOk',
          },
        },
      });

      refetchedOrg = await execute({
        document: OrganizationWithOIDCIntegration,
        variables: {
          organizationId: organization.cleanId,
        },
        authToken: ownerToken,
      }).then(r => r.expectNoGraphQLErrors());

      expect(refetchedOrg).toEqual({
        organization: {
          organization: {
            id: organization.id,
            oidcIntegration: null,
          },
        },
      });
    });

    test("error: user doesn't have permissions", async () => {
      const { ownerToken, createOrg } = await initSeed().createOwner();
      const { organization } = await createOrg();

      const createResult = await execute({
        document: CreateOIDCIntegrationMutation,
        variables: {
          input: {
            organizationId: organization.id,
            clientId: 'foo',
            clientSecret: 'foofoofoofoo',
            tokenEndpoint: 'http://localhost:8888/oauth/token',
            userinfoEndpoint: 'http://localhost:8888/oauth/userinfo',
            authorizationEndpoint: 'http://localhost:8888/oauth/authorize',
          },
        },
        authToken: ownerToken,
      }).then(r => r.expectNoGraphQLErrors());

      const oidcIntegrationId = createResult.createOIDCIntegration.ok!.createdOIDCIntegration.id;

      const { ownerToken: accessTokenExtra } = await initSeed().createOwner();

      const errors = await execute({
        document: DeleteOIDCIntegrationMutation,
        variables: {
          input: {
            oidcIntegrationId,
          },
        },
        authToken: accessTokenExtra,
      }).then(r => r.expectGraphQLErrors());

      expect(errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            message: `No access (reason: "Missing organization:integrations permission")`,
          }),
        ]),
      );
    });

    test.concurrent(
      'success: upon integration deletion oidc members are also deleted',
      async ({ expect }) => {
        const seed = initSeed();
        const { ownerToken, createOrg } = await seed.createOwner();
        const { organization } = await createOrg();

        const createResult = await execute({
          document: CreateOIDCIntegrationMutation,
          variables: {
            input: {
              organizationId: organization.id,
              clientId: 'foo',
              clientSecret: 'foofoofoofoo',
              tokenEndpoint: 'http://localhost:8888/oauth/token',
              userinfoEndpoint: 'http://localhost:8888/oauth/userinfo',
              authorizationEndpoint: 'http://localhost:8888/oauth/authorize',
            },
          },
          authToken: ownerToken,
        }).then(r => r.expectNoGraphQLErrors());

        const oidcIntegrationId = createResult.createOIDCIntegration.ok!.createdOIDCIntegration.id;

        const MeQuery = graphql(`
          query Me {
            me {
              id
            }
          }
        `);

        const { access_token: memberAccessToken } = await seed.authenticate(
          seed.generateEmail(),
          oidcIntegrationId,
        );
        const meResult = await execute({
          document: MeQuery,
          authToken: memberAccessToken,
        }).then(r => r.expectNoGraphQLErrors());

        expect(meResult).toEqual({
          me: {
            id: expect.any(String),
          },
        });

        await execute({
          document: DeleteOIDCIntegrationMutation,
          variables: {
            input: {
              oidcIntegrationId,
            },
          },
          authToken: ownerToken,
        }).then(r => r.expectNoGraphQLErrors());

        const refetchedMeResult = await execute({
          document: MeQuery,
          authToken: memberAccessToken,
        }).then(r => r.expectGraphQLErrors());

        expect(refetchedMeResult).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              message: `No access (reason: "User not found")`,
            }),
          ]),
        );
      },
    );
  });
});

const UpdateOIDCIntegrationMutation = graphql(`
  mutation UpdateOIDCIntegrationMutation($input: UpdateOIDCIntegrationInput!) {
    updateOIDCIntegration(input: $input) {
      ok {
        updatedOIDCIntegration {
          id
          tokenEndpoint
          userinfoEndpoint
          authorizationEndpoint
          clientId
          clientSecretPreview
        }
      }
      error {
        message
        details {
          clientId
          clientSecret
          tokenEndpoint
          userinfoEndpoint
          authorizationEndpoint
        }
      }
    }
  }
`);

describe('update', () => {
  describe('permissions="organization:integrations"', () => {
    test.concurrent('success', async () => {
      const { ownerToken, createOrg } = await initSeed().createOwner();
      const { organization } = await createOrg();

      const createResult = await execute({
        document: CreateOIDCIntegrationMutation,
        variables: {
          input: {
            organizationId: organization.id,
            clientId: 'aaaa',
            clientSecret: 'aaaaaaaaaaaa',
            tokenEndpoint: 'http://localhost:8888/aaaa/token',
            userinfoEndpoint: 'http://localhost:8888/aaaa/userinfo',
            authorizationEndpoint: 'http://localhost:8888/aaaa/authorize',
          },
        },
        authToken: ownerToken,
      }).then(r => r.expectNoGraphQLErrors());

      const oidcIntegrationId = createResult.createOIDCIntegration.ok!.createdOIDCIntegration.id;

      const updateResult = await execute({
        document: UpdateOIDCIntegrationMutation,
        variables: {
          input: {
            oidcIntegrationId,
            clientId: 'bbbb',
            clientSecret: 'bbbbbbbbbbbb',
            tokenEndpoint: 'http://localhost:8888/bbbb/token',
            userinfoEndpoint: 'http://localhost:8888/bbbb/userinfo',
            authorizationEndpoint: 'http://localhost:8888/bbbb/authorize',
          },
        },
        authToken: ownerToken,
      }).then(r => r.expectNoGraphQLErrors());

      expect(updateResult).toEqual({
        updateOIDCIntegration: {
          error: null,
          ok: {
            updatedOIDCIntegration: {
              id: oidcIntegrationId,
              clientId: 'bbbb',
              clientSecretPreview: 'bbbb',
              tokenEndpoint: 'http://localhost:8888/bbbb/token',
              userinfoEndpoint: 'http://localhost:8888/bbbb/userinfo',
              authorizationEndpoint: 'http://localhost:8888/bbbb/authorize',
            },
          },
        },
      });
    });

    test.concurrent('error: user does not have permissions', async ({ expect }) => {
      const { ownerToken, createOrg } = await initSeed().createOwner();
      const { organization } = await createOrg();

      const createResult = await execute({
        document: CreateOIDCIntegrationMutation,
        variables: {
          input: {
            organizationId: organization.id,
            clientId: 'foo',
            clientSecret: 'foofoofoofoo',
            tokenEndpoint: 'http://localhost:8888/oauth/token',
            userinfoEndpoint: 'http://localhost:8888/oauth/userinfo',
            authorizationEndpoint: 'http://localhost:8888/oauth/authorize',
          },
        },
        authToken: ownerToken,
      }).then(r => r.expectNoGraphQLErrors());

      const oidcIntegrationId = createResult.createOIDCIntegration.ok!.createdOIDCIntegration.id;
      const { ownerToken: accessTokenExtra } = await initSeed().createOwner();

      const errors = await execute({
        document: UpdateOIDCIntegrationMutation,
        variables: {
          input: {
            oidcIntegrationId,
          },
        },
        authToken: accessTokenExtra,
      }).then(r => r.expectGraphQLErrors());

      expect(errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            message: `No access (reason: "Missing organization:integrations permission")`,
          }),
        ]),
      );
    });
  });
});
