import { gql } from 'graphql-modules';

export default gql`
  extend type Query {
    target(selector: TargetSelectorInput!): Target
    targets(selector: ProjectSelectorInput!): TargetConnection!
    targetSettings(selector: TargetSelectorInput!): TargetSettings!
  }

  extend type Mutation {
    createTarget(input: CreateTargetInput!): CreateTargetPayload!
    updateTargetName(input: UpdateTargetNameInput!): UpdateTargetPayload!
    deleteTarget(selector: TargetSelectorInput!): DeleteTargetPayload!
    updateTargetValidationSettings(
      input: UpdateTargetValidationSettingsInput!
    ): TargetValidationSettings!
    setTargetValidation(
      input: SetTargetValidationInput!
    ): TargetValidationSettings!
  }

  input TargetSelectorInput {
    organization: ID!
    project: ID!
    target: ID!
  }

  input UpdateTargetValidationSettingsInput {
    organization: ID!
    project: ID!
    target: ID!
    period: Int!
    percentage: Float!
    targets: [ID!]!
  }

  input SetTargetValidationInput {
    organization: ID!
    project: ID!
    target: ID!
    enabled: Boolean!
  }

  type TargetSelector {
    organization: ID!
    project: ID!
    target: ID!
  }

  extend type Project {
    targets: TargetConnection!
  }

  type TargetConnection {
    nodes: [Target!]!
    total: Int!
  }

  type Target {
    id: ID!
    cleanId: ID!
    name: String!
  }

  type TargetSettings {
    id: ID!
    validation: TargetValidationSettings!
  }

  type TargetValidationSettings {
    id: ID!
    enabled: Boolean!
    period: Int!
    percentage: Float!
    targets: [Target!]!
  }

  input CreateTargetInput {
    organization: ID!
    project: ID!
    name: String!
  }

  input UpdateTargetNameInput {
    organization: ID!
    project: ID!
    target: ID!
    name: String!
  }

  type CreateTargetPayload {
    selector: TargetSelector!
    createdTarget: Target!
  }

  type UpdateTargetPayload {
    selector: TargetSelector!
    updatedTarget: Target!
  }

  type DeleteTargetPayload {
    selector: TargetSelector!
    deletedTarget: Target!
  }
`;
