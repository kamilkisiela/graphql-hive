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
    order: [ProjectOrderByInput!]
  }

  input PaginationInput {
    limit: Int
    offset: Int
  }

  input ProjectOrderByInput {
    field: String!
    direction: OrderDirection
  }

  enum OrderDirection {
    ASC
    DESC
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
  const info = collect(op, {}).value;

  expect(info.fields).toContain(`Mutation.deleteProject`);
  expect(info.fields).toContain(`Project.id`);
});

test('collect input object types', async () => {
  const collect = createCollector({
    schema,
    max: 1,
  });
  const info = collect(op, {}).value;

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
    `),
    {},
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
    `),
    {},
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
    `),
    {},
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
    `),
    {},
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
    `),
    {},
  ).value;

  expect(info.fields).toContain(`FilterInput.pagination`);
  expect(info.fields).toContain(`FilterInput.type`);
  expect(info.fields).toContain(`PaginationInput.limit`);
  expect(info.fields).not.toContain(`PaginationInput.offset`);
});

test('collect all input fields when `processVariables` has not been passed and input is passed as a variable', async () => {
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
    `),
    {},
  ).value;

  expect(info.fields).toContain(`FilterInput.pagination`);
  expect(info.fields).toContain(`FilterInput.type`);
  expect(info.fields).toContain(`PaginationInput.limit`);
  expect(info.fields).toContain(`PaginationInput.offset`);
});

test('should get a cache hit when document is the same but variables are different (by default)', async () => {
  const collect = createCollector({
    schema,
    max: 1,
  });
  const doc = parse(/* GraphQL */ `
    query getProjects($pagination: PaginationInput!, $type: ProjectType!) {
      projects(filter: { pagination: $pagination, type: $type }) {
        id
      }
    }
  `);
  const first = collect(doc, {
    pagination: {
      limit: 1,
    },
    type: 'STITCHING',
  });

  const second = collect(doc, {
    pagination: {
      offset: 2,
    },
    type: 'STITCHING',
  });

  expect(first.cacheHit).toBe(false);
  expect(second.cacheHit).toBe(true);
});

test('(processVariables: true) should get a cache miss when document is the same but variables are different', async () => {
  const collect = createCollector({
    schema,
    max: 1,
    processVariables: true,
  });
  const doc = parse(/* GraphQL */ `
    query getProjects($pagination: PaginationInput!, $type: ProjectType!) {
      projects(filter: { pagination: $pagination, type: $type }) {
        id
      }
    }
  `);
  const first = collect(doc, {
    pagination: {
      limit: 1,
    },
    type: 'STITCHING',
  });

  const second = collect(doc, {
    pagination: {
      offset: 2,
    },
    type: 'STITCHING',
  });

  const third = collect(doc, {
    pagination: {
      offset: 2,
    },
    type: 'STITCHING',
  });

  expect(first.cacheHit).toBe(false);
  expect(second.cacheHit).toBe(false);
  expect(third.cacheHit).toBe(true);
});

test('(processVariables: true) collect used-only input fields', async () => {
  const collect = createCollector({
    schema,
    max: 1,
    processVariables: true,
  });
  const info = collect(
    parse(/* GraphQL */ `
      query getProjects($pagination: PaginationInput!, $type: ProjectType!) {
        projects(filter: { pagination: $pagination, type: $type }) {
          id
        }
      }
    `),
    {
      pagination: {
        limit: 1,
      },
      type: 'STITCHING',
    },
  ).value;

  expect(info.fields).toContain(`FilterInput.pagination`);
  expect(info.fields).toContain(`FilterInput.type`);
  expect(info.fields).toContain(`PaginationInput.limit`);
  expect(info.fields).not.toContain(`PaginationInput.offset`);
});

test('(processVariables: true) should collect input object without fields when corresponding variable is not provided', async () => {
  const collect = createCollector({
    schema,
    max: 1,
    processVariables: true,
  });
  const info = collect(
    parse(/* GraphQL */ `
      query getProjects($pagination: PaginationInput, $type: ProjectType!) {
        projects(filter: { pagination: $pagination, type: $type }) {
          id
        }
      }
    `),
    {
      type: 'STITCHING',
    },
  ).value;

  expect(info.fields).toContain(`FilterInput.type`);
  expect(info.fields).toContain(`FilterInput.pagination`);
  expect(info.fields).toContain(`PaginationInput`);
  expect(info.fields).not.toContain(`PaginationInput.limit`);
  expect(info.fields).not.toContain(`PaginationInput.offset`);
});

test('(processVariables: true) collect used-only input type fields from an array', async () => {
  const collect = createCollector({
    schema,
    max: 1,
    processVariables: true,
  });
  const info = collect(
    parse(/* GraphQL */ `
      query getProjects($filter: FilterInput) {
        projects(filter: $filter) {
          id
        }
      }
    `),
    {
      filter: {
        order: [
          {
            field: 'name',
          },
          {
            field: 'buildUrl',
            direction: 'DESC',
          },
        ],
        pagination: {
          limit: 10,
        },
      },
    },
  ).value;

  expect(info.fields).toContain(`FilterInput.pagination`);
  expect(info.fields).toContain(`PaginationInput.limit`);
  expect(info.fields).toContain(`FilterInput.order`);
  expect(info.fields).toContain(`ProjectOrderByInput.field`);
  expect(info.fields).toContain(`ProjectOrderByInput.direction`);
  expect(info.fields).not.toContain(`FilterInput.type`);
  expect(info.fields).not.toContain(`PaginationInput.offset`);
});
