import { gql } from 'graphql-modules';

export default gql`
  extend type Organization {
    plan: BillingPlanType!
    billingConfiguration: BillingConfiguration!
  }

  type BillingConfiguration {
    hasActiveSubscription: Boolean!
    hasPaymentIssues: Boolean!
    paymentMethod: BillingPaymentMethod
    billingAddress: BillingDetails
    invoices: [BillingInvoice!]
    upcomingInvoice: BillingInvoice
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

  type BillingPaymentMethod {
    brand: String!
    last4: String!
    expMonth: Int!
    expYear: Int!
  }

  type BillingDetails {
    city: String
    country: String
    line1: String
    line2: String
    postalCode: String
    state: String
  }

  extend type Query {
    billingPlans: [BillingPlan!]!
  }

  type BillingPlan {
    id: ID!
    planType: BillingPlanType!
    name: String!
    description: String
    basePrice: Float
    includedOperationsLimit: SafeInt
    pricePerOperationsUnit: Float
    rateLimit: UsageRateLimitType!
    retentionInDays: Int!
  }

  enum UsageRateLimitType {
    MONTHLY_QUOTA
    MONTHLY_LIMITED
    UNLIMITED
  }

  enum BillingPlanType {
    HOBBY
    PRO
    ENTERPRISE
  }

  extend type Mutation {
    generateStripePortalLink(selector: OrganizationSelectorInput!): String!
    upgradeToPro(input: UpgradeToProInput!): ChangePlanResult!
    downgradeToHobby(input: DowngradeToHobbyInput!): ChangePlanResult!
    updateOrgRateLimit(
      selector: OrganizationSelectorInput!
      monthlyLimits: RateLimitInput!
    ): Organization!
  }

  input DowngradeToHobbyInput {
    organization: OrganizationSelectorInput!
  }

  input UpgradeToProInput {
    organization: OrganizationSelectorInput!
    paymentMethodId: String
    couponCode: String
    monthlyLimits: RateLimitInput!
  }

  type ChangePlanResult {
    previousPlan: BillingPlanType!
    newPlan: BillingPlanType!
    organization: Organization!
  }
`;
