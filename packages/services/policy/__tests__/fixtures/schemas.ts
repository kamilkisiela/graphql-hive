/**
 * A composed schema written to violate every policy rule at least once, so the parity
 * snapshots record real lint output rather than empty results.
 */
const subgraphSdl = /* GraphQL */ `
  type Mutation {
    createUser(data: CreateUserInput!): User
    deleteUser(id: ID!): Boolean
    mutationUpdatePost(input: UpdatePostInput!): UpdatePostPayload!
  }

  # Inputs accepted by user mutations
  input CreateUserInput {
    user_name: String!
    email: String
  }

  input UpdatePostInput {
    title: String
    id: ID!
  }

  "Result of updating a post"
  type UpdatePostPayload {
    post: Post
  }

  extend type Query {
    search(term: String!): [SearchResult!]!
    findUser(by: FindUserBy!): FindUserResult
  }
`;

export const composedSchema = /* GraphQL */ `
  """
  Root query
  """
  type Query {
    getUser(ID: ID!): User!
    user_by_name(name: String): User
    users(first: Int, after: String): UserConnection!
    queryPosts: [Post!]!
    # Looks up any entity by id
    node(id: ID!): Node
  }

  type Subscription {
    subscriptionUserCreated: User
  }

  interface Node {
    id: ID!
  }

  type User implements Node {
    name: String
    id: ID!
    userEmail: String
    status: Status @deprecated
    legacyRole: String @deprecated(reason: "")
  }

  type Post {
    title: String
    postId: String!
    author: User
  }

  type UserConnection {
    edges: [UserEdge]
    totalCount: Int
  }

  type UserEdge {
    node: User
  }

  type PageInfo {
    hasNextPage: Boolean
  }

  directive @oneOf on INPUT_OBJECT | OBJECT

  input FindUserBy @oneOf {
    id: ID!
    email: String
  }

  type FindUserResult @oneOf {
    user: User
  }

  enum Status {
    active
    ACTIVE
    Disabled
  }

  type orphan_type {
    value: String
  }

  directive @Cache_Control(MaxAge: Int) on FIELD_DEFINITION

  scalar date_time

  union SearchResult = User | Post

  ${subgraphSdl}
`;

/** What a single subgraph submits in a composite check; linted against the composed schema. */
export { subgraphSdl };
