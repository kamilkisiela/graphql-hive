import { gql } from 'graphql-modules';

export default gql`
  extend type Organization {
    supportTickets(first: Int, after: String): SupportTicketConnection
    supportTicket(id: ID!): SupportTicket
  }

  extend type Mutation {
    supportTicketCreate(input: SupportTicketCreateInput!): SupportTicketCreateResult!
    supportTicketReply(input: SupportTicketReplyInput!): SupportTicketReplyResult!
  }

  """
  @oneOf
  """
  type SupportTicketCreateResult {
    ok: SupportTicketCreateResultOk
    error: SupportTicketCreateResultError
  }

  type SupportTicketCreateResultOk {
    supportTicketId: ID!
  }

  type SupportTicketCreateResultError implements Error {
    message: String!
  }

  input SupportTicketCreateInput {
    organization: String!
    subject: String!
    description: String!
    priority: SupportTicketPriority!
  }

  """
  @oneOf
  """
  type SupportTicketReplyResult {
    ok: SupportTicketReplyResultOk
    error: SupportTicketReplyResultError
  }

  type SupportTicketReplyResultOk {
    supportTicketId: ID!
  }

  type SupportTicketReplyResultError implements Error {
    message: String!
  }

  input SupportTicketReplyInput {
    organization: String!
    ticketId: String!
    body: String!
  }

  type SupportTicketConnection {
    edges: [SupportTicketEdge!]!
    pageInfo: PageInfo!
  }

  type SupportTicketEdge {
    node: SupportTicket!
    cursor: String!
  }

  type SupportTicket {
    id: ID!
    status: SupportTicketStatus!
    priority: SupportTicketPriority!
    createdAt: DateTime!
    updatedAt: DateTime!
    subject: String!
    description: String!
    comments: SupportTicketCommentConnection
  }

  type SupportTicketCommentConnection {
    edges: [SupportTicketCommentEdge!]!
    pageInfo: PageInfo!
  }

  type SupportTicketCommentEdge {
    node: SupportTicketComment!
    cursor: String!
  }

  type SupportTicketComment {
    id: ID!
    createdAt: DateTime!
    body: String!
    fromSupport: Boolean!
  }

  enum SupportTicketPriority {
    NORMAL
    HIGH
    URGENT
  }

  enum SupportTicketStatus {
    OPEN
    SOLVED
  }
`;
