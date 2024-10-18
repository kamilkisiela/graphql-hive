import { gql } from 'graphql-modules';

export const typeDefs = gql`
  type PreflightScript {
    id: ID!
    sourceCode: String!
    createdAt: DateTime!
    updatedAt: DateTime!
    # TODO: should I add this field?
    # createdBy: User!
  }

  input CreatePreflightScriptInput {
    sourceCode: String!
  }

  input UpdatePreflightScriptInput {
    id: ID!
    sourceCode: String!
  }

  extend type Mutation {
    createPreflightScript(
      selector: TargetSelectorInput!
      input: CreatePreflightScriptInput!
    ): PreflightScriptResult!
    updatePreflightScript(
      selector: TargetSelectorInput!
      input: UpdatePreflightScriptInput!
    ): PreflightScriptResult!
  }

  """
  @oneOf
  """
  type PreflightScriptResult {
    ok: PreflightScriptOkPayload
    error: PreflightScriptError
  }

  type PreflightScriptOkPayload {
    preflightScript: PreflightScript!
    updatedTarget: Target!
  }

  type PreflightScriptError implements Error {
    message: String!
  }

  extend type Target {
    preflightScript: PreflightScript
  }
`;
