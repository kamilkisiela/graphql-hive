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
    MSTEAMS_WEBHOOK
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
    organizationSlug: String!
    projectSlug: String!
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
    organizationSlug: String!
    projectSlug: String!
    channelIds: [ID!]!
  }

  input AddAlertInput {
    organizationSlug: String!
    projectSlug: String!
    targetSlug: String!
    channelId: ID!
    type: AlertType!
  }

  input DeleteAlertsInput {
    organizationSlug: String!
    projectSlug: String!
    alertIds: [ID!]!
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

  type TeamsWebhookChannel implements AlertChannel {
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
