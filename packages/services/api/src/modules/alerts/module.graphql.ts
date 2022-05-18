import { gql } from 'graphql-modules';

export default gql`
  extend type Mutation {
    addAlertChannel(input: AddAlertChannelInput!): AlertChannel!
    deleteAlertChannels(input: DeleteAlertChannelsInput!): [AlertChannel!]!
    addAlert(input: AddAlertInput!): Alert!
    deleteAlerts(input: DeleteAlertsInput!): [Alert!]!
  }

  extend type Query {
    alertChannels(selector: ProjectSelectorInput!): [AlertChannel!]!
    alerts(selector: ProjectSelectorInput!): [Alert!]!
  }

  enum AlertChannelType {
    SLACK
    WEBHOOK
  }

  enum AlertType {
    SCHEMA_CHANGE_NOTIFICATIONS
  }

  input AddAlertChannelInput {
    organization: ID!
    project: ID!
    name: String!
    type: AlertChannelType!
    slack: SlackChannelInput
    webhook: WebhookChannelInput
  }

  input SlackChannelInput {
    channel: String!
  }

  input WebhookChannelInput {
    endpoint: String!
  }

  input DeleteAlertChannelsInput {
    organization: ID!
    project: ID!
    channels: [ID!]!
  }

  input AddAlertInput {
    organization: ID!
    project: ID!
    target: ID!
    channel: ID!
    type: AlertType!
  }

  input DeleteAlertsInput {
    organization: ID!
    project: ID!
    alerts: [ID!]!
  }

  interface AlertChannel {
    id: ID!
    name: String!
    type: AlertChannelType!
  }

  type AlertSlackChannel implements AlertChannel {
    id: ID!
    name: String!
    type: AlertChannelType!
    channel: String!
  }

  type AlertWebhookChannel implements AlertChannel {
    id: ID!
    name: String!
    type: AlertChannelType!
    endpoint: String!
  }

  type Alert {
    id: ID!
    type: AlertType!
    channel: AlertChannel!
    target: Target!
  }
`;
