import { gql } from 'graphql-modules';

export default gql`
  extend type Organization {
    plan: BillingPlanType!
    billingConfiguration: BillingConfiguration!
  }

  enum BillingProvider {
    STRIPE
    PADDLE
    WIRE
  }

  type BillingConfiguration {
    provider: BillingProvider
    hasActiveSubscription: Boolean!
    canUpdateSubscription: Boolean!
    hasPaymentIssues: Boolean!
    invoices: [BillingInvoice!]
    nextPayment: BillingNextPayment
    taxId: String
    legalName: String
    billingEmail: String
    paymentMethod: BillingPaymentMethod
    trialEnd: Date
  }

  type BillingNextPayment {
    amount: Float!
    date: Date!
  }

  type BillingPaymentMethod {
    methodType: String!
    brand: String
    identifier: String
  }

  type BillingInvoice {
    id: ID!
    amount: Float!
    date: DateTime!
    periodStart: DateTime!
    periodEnd: DateTime!
    pdfLink: String
    status: BillingInvoiceStatus!
  }

  enum BillingInvoiceStatus {
    DRAFT
    OPEN
    PAID
    VOID
    UNCOLLECTIBLE
  }

  extend type Query {
    billingPlans: [BillingPlan!]!
  }

  type BillingPlan {
    id: ID!
    planType: BillingPlanType!
    name: String!
    description: String
    basePrice: BillingPlanPrice
    includedOperationsLimit: SafeInt
    pricePerOperationsUnit: BillingPlanPrice
    retentionInDays: Int!
  }

  type BillingPlanPrice {
    id: ID!
    amount: Float!
  }

  enum BillingPlanType {
    HOBBY
    PRO
    ENTERPRISE
  }

  extend type Mutation {
    generateSubscriptionManagementLink(selector: OrganizationSelectorInput!): String!
      @deprecated(reason: "Migrating away from Stripe to Paddle. This will be removed soon.")
    generatePaymentMethodUpdateToken(selector: OrganizationSelectorInput!): String!
    downgradeToHobby(input: DowngradeToHobbyInput!): ChangePlanResult!
    updateOrgRateLimit(
      selector: OrganizationSelectorInput!
      monthlyLimits: RateLimitInput!
    ): Organization!
    updateBillingDetails(input: UpdateBillingDetailsInput!): Organization!
  }

  input UpdateBillingDetailsInput {
    selector: OrganizationSelectorInput!
    taxId: String
    legalName: String
    billingEmail: String
  }

  input DowngradeToHobbyInput {
    organization: OrganizationSelectorInput!
  }

  type ChangePlanResult {
    previousPlan: BillingPlanType!
    newPlan: BillingPlanType!
    organization: Organization!
  }
`;
