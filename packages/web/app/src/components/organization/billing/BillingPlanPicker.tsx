import { ReactElement, ReactNode } from 'react';
import { Check } from 'lucide-react';
import { Badge } from '@/components/ui/primitives/badge/badge';
import { RadioGroup } from '@/components/ui/primitives/radio-group/radio-group';
import { FragmentType, graphql, useFragment } from '@/gql';
import { BillingPlanType } from '@/gql/graphql';

export const planCollection: {
  [key in BillingPlanType]: {
    description: string;
    features: (ReactNode | string)[];
    footer?: ReactNode;
  };
} = {
  [BillingPlanType.Hobby]: {
    description: 'For personal or small projects',
    features: [
      'Unlimited seats, projects and organizations',
      'Unlimited schema pushes & checks',
      'Full access to all features (including SSO)',
      'Limit of 1M operations per month',
      '7 days of usage data retention',
    ],
  },
  [BillingPlanType.Pro]: {
    description: 'For scaling APIs and teams',
    features: [
      '+ $10 per 1M operations',
      'Change your plan at any time',
      'Everything in Hobby plan, and:',
      '90 days of usage data retention',
    ],
    footer: (
      <>
        <div className="mb-2 text-sm font-bold">Free 30 days trial period</div>
      </>
    ),
  },
  [BillingPlanType.Enterprise]: {
    description: 'Custom plan for large companies',
    features: [
      'Unlimited seats',
      'Unlimited operations',
      'Unlimited schema pushes',
      'Change your plan at any time',
      'Improved pricing as you scale',
      '12 months of usage data retention',
      <span key="enterprise" className="gap-1">
        GraphQL/APIs support and guidance
        <br />
        from{' '}
        <a
          href="https://the-guild.dev"
          target="_blank"
          rel="noreferrer"
          className="font-medium text-accent transition-colors hover:underline"
        >
          The Guild
        </a>
      </span>,
    ],
    footer: 'Shape a custom plan for your business',
  },
};

export function Plan(plan: {
  isActive: boolean;
  name: string;
  price: string | number;
  description: string;
  features: ReactNode[];
  footer?: ReactNode;
}): ReactElement {
  return (
    // `self-stretch` because the radio item centers its content, and a plan body must fill the
    // card so the footers line up across plans with different feature counts.
    <div className="flex h-full w-full flex-col justify-between self-stretch">
      <div>
        <h2 className="flex items-center justify-between text-base font-bold text-fg-default">
          {plan.name}
          {plan.isActive && <Badge content="CURRENT PLAN" variants={{ variant: 'default' }} />}
        </h2>

        <div className="text-3xl font-bold">
          {typeof plan.price === 'string' ? (
            plan.price
          ) : (
            <>
              ${plan.price}
              <span className="text-sm text-fg-secondary">/mo</span>
            </>
          )}
        </div>
        <div className="text-sm text-fg-secondary">{plan.description}</div>
        <div className="mt-6 flex flex-col gap-2">
          {plan.features.map((feature, i) => (
            <div key={i}>
              <div className="flex items-center gap-1 text-sm text-fg-secondary">
                <Check className="size-5 text-fg-secondary" />
                {feature}
              </div>
            </div>
          ))}
        </div>
      </div>
      {plan.footer && (
        <div>
          <div className="mx-auto my-4 w-9/12 border-b border-line" />
          <div className="text-xs text-fg-default">{plan.footer}</div>
        </div>
      )}
    </div>
  );
}

const billingPlanLookUpMap = {
  [BillingPlanType.Hobby]: 'Free',
} as Record<BillingPlanType, string | undefined>;

export const BillingPlanPicker_PlanFragment = graphql(`
  fragment BillingPlanPicker_PlanFragment on BillingPlan {
    planType
    id
    name
    basePrice
  }
`);

export function BillingPlanPicker({
  value,
  onPlanChange,
  activePlan,
  disabled,
  ...props
}: {
  disabled?: boolean;
  value: BillingPlanType;
  activePlan: BillingPlanType;
  plans: ReadonlyArray<FragmentType<typeof BillingPlanPicker_PlanFragment>>;
  onPlanChange: (plan: BillingPlanType) => void;
}): ReactElement {
  const plans = useFragment(BillingPlanPicker_PlanFragment, props.plans);
  return (
    <RadioGroup
      variant="as-card"
      orientation="horizontal"
      disabled={disabled}
      value={value}
      onValueChange={nextPlan => onPlanChange(nextPlan as BillingPlanType)}
      items={plans.map(plan => ({
        value: plan.planType,
        content: (
          <Plan
            name={plan.name}
            price={billingPlanLookUpMap[plan.planType] ?? plan.basePrice ?? 'Contact Us'}
            isActive={activePlan === plan.planType}
            features={planCollection[plan.planType].features}
            description={planCollection[plan.planType].description}
            footer={planCollection[plan.planType].footer}
          />
        ),
      }))}
    />
  );
}
