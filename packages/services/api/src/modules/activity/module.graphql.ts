import { gql } from 'graphql-modules';

export default gql`
  interface Activity {
    id: ID!
    type: String!
    createdAt: DateTime!
  }

  extend type Query {
    organizationActivities(selector: OrganizationActivitiesSelector!): ActivityConnection!
    projectActivities(selector: ProjectActivitiesSelector!): ActivityConnection!
    targetActivities(selector: TargetActivitiesSelector!): ActivityConnection!
  }

  input OrganizationActivitiesSelector {
    organization: ID!
    limit: Int!
  }

  input ProjectActivitiesSelector {
    organization: ID!
    project: ID!
    limit: Int!
  }

  input TargetActivitiesSelector {
    organization: ID!
    project: ID!
    target: ID!
    limit: Int!
  }

  type ActivityConnection {
    nodes: [Activity!]!
    total: Int!
  }

  type OrganizationCreatedActivity implements Activity {
    id: ID!
    type: String!
    createdAt: DateTime!
    organization: Organization!
    user: User!
  }

  type OrganizationPlanChangeActivity implements Activity {
    id: ID!
    type: String!
    createdAt: DateTime!
    organization: Organization!
    user: User!
    newPlan: BillingPlanType!
    previousPlan: BillingPlanType!
  }

  type OrganizationNameUpdatedActivity implements Activity {
    id: ID!
    type: String!
    createdAt: DateTime!
    organization: Organization!
    user: User!
    value: String!
  }

  type OrganizationIdUpdatedActivity implements Activity {
    id: ID!
    type: String!
    createdAt: DateTime!
    organization: Organization!
    user: User!
    value: String!
  }

  type MemberAddedActivity implements Activity {
    id: ID!
    type: String!
    createdAt: DateTime!
    organization: Organization!
    user: User!
  }

  type MemberDeletedActivity implements Activity {
    id: ID!
    type: String!
    createdAt: DateTime!
    organization: Organization!
    user: User!
    email: String!
  }

  type MemberLeftActivity implements Activity {
    id: ID!
    type: String!
    createdAt: DateTime!
    organization: Organization!
    email: String!
  }

  type ProjectCreatedActivity implements Activity {
    id: ID!
    type: String!
    createdAt: DateTime!
    organization: Organization!
    user: User!
    project: Project!
  }

  type ProjectDeletedActivity implements Activity {
    id: ID!
    type: String!
    createdAt: DateTime!
    organization: Organization!
    user: User!
    name: String!
    cleanId: String!
  }

  type ProjectNameUpdatedActivity implements Activity {
    id: ID!
    type: String!
    createdAt: DateTime!
    organization: Organization!
    user: User!
    project: Project!
    value: String!
  }

  type ProjectIdUpdatedActivity implements Activity {
    id: ID!
    type: String!
    createdAt: DateTime!
    organization: Organization!
    user: User!
    project: Project!
    value: String!
  }

  type TargetCreatedActivity implements Activity {
    id: ID!
    type: String!
    createdAt: DateTime!
    organization: Organization!
    user: User!
    project: Project!
    target: Target!
  }

  type TargetDeletedActivity implements Activity {
    id: ID!
    type: String!
    createdAt: DateTime!
    organization: Organization!
    user: User!
    project: Project!
    name: String!
    cleanId: String!
  }

  type TargetNameUpdatedActivity implements Activity {
    id: ID!
    type: String!
    createdAt: DateTime!
    organization: Organization!
    user: User!
    project: Project!
    target: Target!
    value: String!
  }

  type TargetIdUpdatedActivity implements Activity {
    id: ID!
    type: String!
    createdAt: DateTime!
    organization: Organization!
    user: User!
    project: Project!
    target: Target!
    value: String!
  }
`;
