import { parse, buildSchema } from 'graphql';
import { createCollector } from '../src/internal/usage';

const schema = buildSchema(/* GraphQL */ `
  type Query {
    project(selector: ProjectSelectorInput!): Project
    projectsByType(type: ProjectType!): [Project!]!
    projects(filter: FilterInput): [Project!]!
  }

  type Mutation {
    deleteProject(selector: ProjectSelectorInput!): DeleteProjectPayload!
  }

  input ProjectSelectorInput {
    organization: ID!
    project: ID!
  }

  input FilterInput {
    type: ProjectType
    pagination: PaginationInput
  }

  input PaginationInput {
    limit: Int
    offset: Int
  }

  type ProjectSelector {
    organization: ID!
    project: ID!
  }

  type DeleteProjectPayload {
    selector: ProjectSelector!
    deletedProject: Project!
  }

  type Project {
    id: ID!
    cleanId: ID!
    name: String!
    type: ProjectType!
    buildUrl: String
    validationUrl: String
  }

  enum ProjectType {
    FEDERATION
    STITCHING
    SINGLE
    CUSTOM
  }
`);

const op = parse(/* GraphQL */ `
  mutation deleteProject($selector: ProjectSelectorInput!) {
    deleteProject(selector: $selector) {
      selector {
        organization
        project
      }
      deletedProject {
        ...ProjectFields
      }
    }
  }

  fragment ProjectFields on Project {
    id
    cleanId
    name
    type
  }
`);

test('collect fields', async () => {
  const collect = createCollector({
    schema,
    max: 1,
  });
  const info = collect(op).value;

  expect(info.fields).toContain(`Mutation.deleteProject`);
  expect(info.fields).toContain(`Project.id`);
});

test('collect input object types', async () => {
  const collect = createCollector({
    schema,
    max: 1,
  });
  const info = collect(op).value;

  expect(info.fields).toContain(`ProjectSelectorInput.organization`);
  expect(info.fields).toContain(`ProjectSelectorInput.project`);
});

test('collect enums and scalars as inputs', async () => {
  const collect = createCollector({
    schema,
    max: 1,
  });
  const info = collect(
    parse(/* GraphQL */ `
      query getProjects($limit: Int!, $type: ProjectType!) {
        projects(filter: { pagination: { limit: $limit }, type: $type }) {
          id
        }
      }
    `)
  ).value;

  expect(info.fields).toContain(`Int`);
  expect(info.fields).toContain(`ProjectType.FEDERATION`);
  expect(info.fields).toContain(`ProjectType.STITCHING`);
  expect(info.fields).toContain(`ProjectType.SINGLE`);
  expect(info.fields).toContain(`ProjectType.CUSTOM`);
});

test('collect enum values from object fields', async () => {
  const collect = createCollector({
    schema,
    max: 1,
  });
  const info = collect(
    parse(/* GraphQL */ `
      query getProjects($limit: Int!) {
        projects(filter: { pagination: { limit: $limit }, type: FEDERATION }) {
          id
        }
      }
    `)
  ).value;

  expect(info.fields).toContain(`Int`);
  expect(info.fields).toContain(`ProjectType.FEDERATION`);
  expect(info.fields).not.toContain(`ProjectType.STITCHING`);
  expect(info.fields).not.toContain(`ProjectType.SINGLE`);
  expect(info.fields).not.toContain(`ProjectType.CUSTOM`);
});

test('collect enum values from arguments', async () => {
  const collect = createCollector({
    schema,
    max: 1,
  });
  const info = collect(
    parse(/* GraphQL */ `
      query getProjects {
        projectsByType(type: FEDERATION) {
          id
        }
      }
    `)
  ).value;

  expect(info.fields).toContain(`ProjectType.FEDERATION`);
  expect(info.fields).not.toContain(`ProjectType.STITCHING`);
  expect(info.fields).not.toContain(`ProjectType.SINGLE`);
  expect(info.fields).not.toContain(`ProjectType.CUSTOM`);
});

test('collect arguments', async () => {
  const collect = createCollector({
    schema,
    max: 1,
  });
  const info = collect(
    parse(/* GraphQL */ `
      query getProjects($limit: Int!, $type: ProjectType!) {
        projects(filter: { pagination: { limit: $limit }, type: $type }) {
          id
        }
      }
    `)
  ).value;

  expect(info.fields).toContain(`Query.projects.filter`);
});

test('collect used-only input fields', async () => {
  const collect = createCollector({
    schema,
    max: 1,
  });
  const info = collect(
    parse(/* GraphQL */ `
      query getProjects($limit: Int!, $type: ProjectType!) {
        projects(filter: { pagination: { limit: $limit }, type: $type }) {
          id
        }
      }
    `)
  ).value;

  expect(info.fields).toContain(`FilterInput.pagination`);
  expect(info.fields).toContain(`FilterInput.type`);
  expect(info.fields).toContain(`PaginationInput.limit`);
  expect(info.fields).not.toContain(`PaginationInput.offset`);
});

test('collect all input fields when it is impossible to pick only those used', async () => {
  const collect = createCollector({
    schema,
    max: 1,
  });
  const info = collect(
    parse(/* GraphQL */ `
      query getProjects($pagination: PaginationInput!, $type: ProjectType!) {
        projects(filter: { pagination: $pagination, type: $type }) {
          id
        }
      }
    `)
  ).value;

  expect(info.fields).toContain(`FilterInput.pagination`);
  expect(info.fields).toContain(`FilterInput.type`);
  expect(info.fields).toContain(`PaginationInput.limit`);
  expect(info.fields).toContain(`PaginationInput.offset`);
});
