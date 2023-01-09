import { ReactElement, ReactNode } from 'react';
import { List, ListIcon, ListItem } from '@chakra-ui/react';
import { VscCheck } from 'react-icons/vsc';
import { Label, Section } from '@/components/common';
import { Link, Radio, RadioGroup } from '@/components/v2';
import { BillingPlansQuery, BillingPlanType } from '@/graphql';

const planCollection: {
  [key in BillingPlanType]: {
    description: string;
    features: Array<ReactNode | string>;
    footer?: ReactNode;
  };
} = {
  [BillingPlanType.Hobby]: {
    description: 'For personal or small projects',
    features: [
      'Unlimited seats',
      'Unlimited schema pushes',
      'Limit of 1M operations',
      '7 days of usage data retention',
    ],
  },
  [BillingPlanType.Pro]: {
    description: 'For scaling API',
    features: [
      'Unlimited seats',
      'Unlimited schema pushes',
      '$10 per 1M operations',
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
      '12 months of usage data retention',
      <span className="flex gap-1">
        Support from
        <Link variant="primary" href="https://the-guild.dev" target="_blank" rel="noreferrer">
          The Guild
        </Link>
      </span>,
    ],
    footer: 'Shape a custom plan for your business',
  },
};

const Plan = (plan: {
  isActive: boolean;
  name: string;
  price: string | number;
  description: string;
  features: ReactNode[];
  footer?: ReactNode;
}): ReactElement => {
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
        <div>
          <List spacing={2} className="mt-6">
            {plan.features.map((feature, i) => (
              <ListItem key={i}>
                <Section.Subtitle className="flex items-center">
                  <ListIcon color="gray.500" as={VscCheck} />
                  {feature}
                </Section.Subtitle>
              </ListItem>
            ))}
          </List>
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
};

const billingPlanLookUpMap = {
  [BillingPlanType.Hobby]: 'Free',
} as Record<BillingPlanType, string | undefined>;

export const BillingPlanPicker = ({
  value,
  activePlan,
  plans,
  onPlanChange,
}: {
  value: BillingPlanType;
  activePlan: BillingPlanType;
  plans: BillingPlansQuery['billingPlans'];
  onPlanChange: (plan: BillingPlanType) => void;
}): ReactElement => {
  return (
    <RadioGroup value={value} onValueChange={onPlanChange} className="flex gap-4 md:!flex-row">
      {plans.map(plan => (
        <Radio value={plan.planType} key={plan.id} className="!rounded-md border p-4 md:w-1/3">
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
};
