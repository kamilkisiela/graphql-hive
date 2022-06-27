import { gql } from 'urql';

export const ActivityNode = gql(/* GraphQL */ `
  fragment ActivityNode on Activity {
    id
    type
    createdAt
    ...OrganizationPlanChange
    ...OrganizationCreated
    ...OrganizationNameUpdated
    ...OrganizationIdUpdated
    ...MemberAdded
    ...MemberDeleted
    ...ProjectCreated
    ...ProjectDeleted
    ...ProjectNameUpdated
    ...ProjectIdUpdated
    ...TargetCreated
    ...TargetDeleted
    ...TargetNameUpdated
    ...TargetIdUpdated
  }
`);
