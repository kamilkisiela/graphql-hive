import { buildSchema, parse } from 'graphql';
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
    owner: User!
  }

  enum ProjectType {
    FEDERATION
    STITCHING
    SINGLE
    CUSTOM
  }

  union User = Admin | Member

  type Admin {
    id: ID!
    name: String!
    isSuperAdmin: Boolean!
  }

  type Member {
    id: ID!
    name: String!
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

  expect(info.fields).toMatchInlineSnapshot(`
    [
      Mutation.deleteProject,
      Mutation.deleteProject.selector,
      DeleteProjectPayload.selector,
      ProjectSelector.organization,
      ProjectSelector.project,
      DeleteProjectPayload.deletedProject,
      Project.id,
      Project.cleanId,
      Project.name,
      Project.type,
      ProjectSelectorInput.organization,
      ID,
      ProjectSelectorInput.project,
    ]
  `);
});

test('union with __typename only', async () => {
  const collect = createCollector({
    schema,
    max: 1,
  });
  const info = collect(
    parse(/* GraphQL */ `
      {
        projects {
          id
          owner {
            __typename
          }
        }
      }
    `),
    {},
  ).value;

  expect(info.fields).toMatchInlineSnapshot(`
    [
      Query.projects,
      Project.id,
      Project.owner,
      User.__typename,
    ]
  `);
});

test('union with single member', async () => {
  const collect = createCollector({
    schema,
    max: 1,
  });
  const info = collect(
    parse(/* GraphQL */ `
      {
        projects {
          id
          owner {
            ... on Admin {
              id
            }
          }
        }
      }
    `),
    {},
  ).value;

  expect(info.fields).toMatchInlineSnapshot(`
    [
      Query.projects,
      Project.id,
      Project.owner,
      Admin.id,
    ]
  `);
});

test('collect input object types', async () => {
  const collect = createCollector({
    schema,
    max: 1,
  });
  const info = collect(op, {}).value;

  expect(info.fields).toMatchInlineSnapshot(`
    [
      Mutation.deleteProject,
      Mutation.deleteProject.selector,
      DeleteProjectPayload.selector,
      ProjectSelector.organization,
      ProjectSelector.project,
      DeleteProjectPayload.deletedProject,
      Project.id,
      Project.cleanId,
      Project.name,
      Project.type,
      ProjectSelectorInput.organization,
      ID,
      ProjectSelectorInput.project,
    ]
  `);
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

  expect(info.fields).toMatchInlineSnapshot(`
    [
      Query.projects,
      Query.projects.filter,
      Project.id,
      Int,
      ProjectType.FEDERATION,
      ProjectType.STITCHING,
      ProjectType.SINGLE,
      ProjectType.CUSTOM,
      FilterInput.pagination,
      FilterInput.type,
      PaginationInput.limit,
    ]
  `);
});

test('collect scalars as hard-coded inputs', async () => {
  const collect = createCollector({
    schema,
    max: 1,
  });
  const info = collect(
    parse(/* GraphQL */ `
      {
        projects(filter: { pagination: { limit: 20 } }) {
          id
        }
      }
    `),
    {},
  ).value;

  expect(info.fields).toMatchInlineSnapshot(`
    [
      Query.projects,
      Query.projects.filter,
      Project.id,
      FilterInput.pagination,
      Int,
      PaginationInput.limit,
    ]
  `);
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

  expect(info.fields).toMatchInlineSnapshot(`
    [
      Query.projects,
      Query.projects.filter,
      Project.id,
      Int,
      FilterInput.pagination,
      FilterInput.type,
      PaginationInput.limit,
      ProjectType.FEDERATION,
    ]
  `);
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

  expect(info.fields).toMatchInlineSnapshot(`
    [
      Query.projectsByType,
      Query.projectsByType.type,
      Project.id,
      ProjectType.FEDERATION,
    ]
  `);
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

  expect(info.fields).toMatchInlineSnapshot(`
    [
      Query.projects,
      Query.projects.filter,
      Project.id,
      Int,
      ProjectType.FEDERATION,
      ProjectType.STITCHING,
      ProjectType.SINGLE,
      ProjectType.CUSTOM,
      FilterInput.pagination,
      FilterInput.type,
      PaginationInput.limit,
    ]
  `);
});

test('skips argument directives', async () => {
  const collect = createCollector({
    schema,
    max: 1,
  });
  const info = collect(
    parse(/* GraphQL */ `
      query getProjects($limit: Int!, $type: ProjectType!, $includeName: Boolean!) {
        projects(filter: { pagination: { limit: $limit }, type: $type }) {
          id
          ...NestedFragment
        }
      }

      fragment NestedFragment on Project {
        ...IncludeNameFragment @include(if: $includeName)
      }

      fragment IncludeNameFragment on Project {
        name
      }
    `),
    {},
  ).value;

  expect(info.fields).toMatchInlineSnapshot(`
    [
      Query.projects,
      Query.projects.filter,
      Project.id,
      Project.name,
      Int,
      ProjectType.FEDERATION,
      ProjectType.STITCHING,
      ProjectType.SINGLE,
      ProjectType.CUSTOM,
      Boolean,
      FilterInput.pagination,
      FilterInput.type,
      PaginationInput.limit,
    ]
  `);
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

  expect(info.fields).toMatchInlineSnapshot(`
    [
      Query.projects,
      Query.projects.filter,
      Project.id,
      Int,
      ProjectType.FEDERATION,
      ProjectType.STITCHING,
      ProjectType.SINGLE,
      ProjectType.CUSTOM,
      FilterInput.pagination,
      FilterInput.type,
      PaginationInput.limit,
    ]
  `);
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

  expect(info.fields).toMatchInlineSnapshot(`
    [
      Query.projects,
      Query.projects.filter,
      Project.id,
      PaginationInput.limit,
      Int,
      PaginationInput.offset,
      ProjectType.FEDERATION,
      ProjectType.STITCHING,
      ProjectType.SINGLE,
      ProjectType.CUSTOM,
      FilterInput.pagination,
      FilterInput.type,
    ]
  `);
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

  expect(info.fields).toMatchInlineSnapshot(`
    [
      Query.projects,
      Query.projects.filter,
      Project.id,
      PaginationInput.limit,
      Int,
      ProjectType.FEDERATION,
      ProjectType.STITCHING,
      ProjectType.SINGLE,
      ProjectType.CUSTOM,
      FilterInput.pagination,
      FilterInput.type,
    ]
  `);
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

  expect(info.fields).toMatchInlineSnapshot(`
    [
      PaginationInput,
      Query.projects,
      Query.projects.filter,
      Project.id,
      ProjectType.FEDERATION,
      ProjectType.STITCHING,
      ProjectType.SINGLE,
      ProjectType.CUSTOM,
      FilterInput.pagination,
      FilterInput.type,
    ]
  `);
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

  expect(info.fields).toMatchInlineSnapshot(`
    [
      Query.projects,
      Query.projects.filter,
      Project.id,
      FilterInput.order,
      FilterInput.pagination,
      ProjectOrderByInput.field,
      ProjectOrderByInput.direction,
      String,
      OrderDirection.ASC,
      OrderDirection.DESC,
      PaginationInput.limit,
      Int,
    ]
  `);
});
