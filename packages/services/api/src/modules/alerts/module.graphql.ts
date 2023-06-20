import { gql } from 'graphql-modules';

export default gql`
  extend type Mutation {
    addAlertChannel(input: AddAlertChannelInput!): AddAlertChannelResult!
    deleteAlertChannels(input: DeleteAlertChannelsInput!): DeleteAlertChannelsResult!
    addAlert(input: AddAlertInput!): AddAlertResult!
    deleteAlerts(input: DeleteAlertsInput!): DeleteAlertsResult!
  }

  extend type Project {
    alertChannels: [AlertChannel!]!
    alerts: [Alert!]!
  }

  enum AlertChannelType {
    SLACK
    WEBHOOK
  }

  enum AlertType {
    SCHEMA_CHANGE_NOTIFICATIONS
  }

  type DeleteAlertChannelsResult {
    ok: DeleteAlertChannelsOk
    error: DeleteAlertChannelsError
  }

  type DeleteAlertChannelsOk {
    updatedProject: Project!
  }

  type DeleteAlertChannelsError implements Error {
    message: String!
  }

  type AddAlertResult {
    ok: AddAlertOk
    error: AddAlertError
  }

  type AddAlertOk {
    updatedProject: Project!
    addedAlert: Alert!
  }

  type AddAlertError implements Error {
    message: String!
  }

  type DeleteAlertsResult {
    ok: DeleteAlertsOk
    error: DeleteAlertsError
  }

  type DeleteAlertsOk {
    updatedProject: Project!
  }

  type DeleteAlertsError implements Error {
    message: String!
  }

  type AddAlertChannelResult {
    ok: AddAlertChannelOk
    error: AddAlertChannelError
  }

  type AddAlertChannelOk {
    updatedProject: Project!
    addedAlertChannel: AlertChannel!
  }

  type AddAlertChannelError implements Error {
    message: String!
    inputErrors: AddAlertChannelInputErrors!
  }

  type AddAlertChannelInputErrors {
    name: String
    webhookEndpoint: String
    slackChannel: String
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
