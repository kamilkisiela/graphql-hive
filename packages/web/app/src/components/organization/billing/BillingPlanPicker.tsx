import { ReactElement, ReactNode } from 'react';
import { Label, Section } from '@/components/common';
import { Radio, RadioGroup } from '@/components/v2';
import { FragmentType, graphql, useFragment } from '@/gql';
import { BillingPlanType } from '@/graphql';
import { CheckIcon } from '@radix-ui/react-icons';

const planCollection: {
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
      <span className="gap-1">
        GraphQL/APIs support and guidance
        <br />
        from{' '}
        <a
          href="https://the-guild.dev"
          target="_blank"
          rel="noreferrer"
          className="font-medium text-orange-500 transition-colors hover:underline"
        >
          The Guild
        </a>
      </span>,
    ],
    footer: 'Shape a custom plan for your business',
  },
};

function Plan(plan: {
  isActive: boolean;
  name: string;
  price: string | number;
  description: string;
  features: ReactNode[];
  footer?: ReactNode;
}): ReactElement {
  return (
    <div className="flex h-full flex-col justify-between">
      <div>
        <Section.BigTitle className="flex items-center justify-between">
          {plan.name}
          {plan.isActive && <Label>CURRENT PLAN</Label>}
        </Section.BigTitle>
        <div className="text-3xl font-bold">
          {typeof plan.price === 'string' ? (
            plan.price
          ) : (
            <>
              ${plan.price}
              <span className="text-sm text-gray-500">/mo</span>
            </>
          )}
        </div>
        <div className="text-sm text-gray-500">{plan.description}</div>
        <div className="mt-6 flex flex-col gap-2">
          {plan.features.map((feature, i) => (
            <div key={i}>
              <Section.Subtitle className="flex items-center gap-1">
                <CheckIcon className="h-5 w-auto text-gray-500" />
                {feature}
              </Section.Subtitle>
            </div>
          ))}
        </div>
      </div>
      {plan.footer && (
        <div>
          <div className="mx-auto my-4 w-9/12 border-b border-gray-800" />
          <div className="text-xs text-gray-300">{plan.footer}</div>
        </div>
      )}
    </div>
  );
}

const billingPlanLookUpMap = {
  [BillingPlanType.Hobby]: 'Free',
} as Record<BillingPlanType, string | undefined>;

const BillingPlanPicker_PlanFragment = graphql(`
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
    <RadioGroup value={value} onValueChange={onPlanChange} className="flex gap-4 md:!flex-row">
      {plans.map(plan => (
        <Radio
          disabled={disabled}
          value={plan.planType}
          key={plan.id}
          className="!rounded-md border p-4 md:w-1/3"
        >
          <Plan
            key={plan.id}
            name={plan.name}
            price={billingPlanLookUpMap[plan.planType] ?? plan.basePrice ?? 'Contact Us'}
            isActive={activePlan === plan.planType}
            features={planCollection[plan.planType].features}
            description={planCollection[plan.planType].description}
            footer={planCollection[plan.planType].footer}
          />
        </Radio>
      ))}
    </RadioGroup>
  );
}
