import { gql } from 'graphql-modules';

export default gql`
  """
  A date-time string at UTC, such as '2007-12-03T10:15:30Z', is compliant with the date-time format outlined
  in section 5.6 of the RFC 3339 profile of the ISO 8601 standard for representation of dates and times using the Gregorian calendar.

  This scalar is a description of an exact instant on the timeline such as the instant that a user account was created.

  This scalar ignores leap seconds (thereby assuming that a minute constitutes 59 seconds). In this respect, it diverges from the RFC 3339 profile.

  Where an RFC 3339 compliant date-time string has a time-zone other than UTC, it is shifted to UTC. For example, the date-time string '2016-01-01T14:10:20+01:00' is shifted to '2016-01-01T13:10:20Z'.
  """
  scalar DateTime
    @tag(name: "public")
    @specifiedBy(url: "https://the-guild.dev/graphql/scalars/docs/scalars/date-time")

  """
  A date-time string at UTC with nano-second precision, such as '2007-12-03T10:15:30.123456Z', is compliant with the extended date-time format outlined in section 5.6 of the RFC 3339 profile of the ISO 8601 standard for representation of dates and times using the Gregorian calendar. The fractional part of the seconds can range up to nanosecond precision.

  This scalar represents an exact instant on the timeline, such as the precise moment a user account was created, including fractional seconds.

  This scalar ignores leap seconds (thereby assuming that a minute constitutes 59 seconds). In this respect, it diverges from the RFC 3339 profile.

  Where an RFC 3339 compliant date-time string has a time-zone other than UTC, it is shifted to UTC. For example, the date-time string '2016-01-01T14:10:20.500+01:00' is shifted to '2016-01-01T13:10:20.500Z'.
  """
  scalar DateTime64

  scalar JSONObject

  scalar Date
  scalar JSON
  scalar JSONSchemaObject
  scalar SafeInt @tag(name: "public")

  extend schema
    @link(url: "https://specs.apollo.dev/link/v1.0")
    @link(
      url: "https://specs.apollo.dev/federation/v2.9"
      import: ["@tag", "@composeDirective", "@listSize", "@cost"]
    )
    @link(url: "https://github.com/graphql/graphql-spec/pull/825/v0.1", import: ["@oneOf"])
    @composeDirective(name: "@oneOf")

  directive @oneOf on INPUT_OBJECT

  directive @link(url: String!, import: [String!]) repeatable on SCHEMA
  directive @composeDirective(name: String!) repeatable on SCHEMA

  directive @listSize(
    assumedSize: Int
    slicingArguments: [String!]
    sizedFields: [String!]
    requireOneSlicingArgument: Boolean = true
  ) on FIELD_DEFINITION

  directive @cost(
    weight: Int!
  ) on ARGUMENT_DEFINITION | ENUM | FIELD_DEFINITION | INPUT_FIELD_DEFINITION | OBJECT | SCALAR

  directive @tag(
    name: String!
  ) repeatable on FIELD_DEFINITION | INTERFACE | OBJECT | UNION | ARGUMENT_DEFINITION | SCALAR | ENUM | ENUM_VALUE | INPUT_OBJECT | INPUT_FIELD_DEFINITION

  type Query

  type Mutation

  type Subscription

  type PageInfo {
    hasNextPage: Boolean! @tag(name: "public")
    hasPreviousPage: Boolean! @tag(name: "public")
    startCursor: String! @tag(name: "public")
    endCursor: String! @tag(name: "public")
  }

  interface Error {
    message: String!
  }
`;
