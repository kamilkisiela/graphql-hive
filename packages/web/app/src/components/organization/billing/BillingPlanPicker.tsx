import React from 'react';
import { List, ListIcon, ListItem } from '@chakra-ui/react';
import { VscCheck } from 'react-icons/vsc';
import { BillingPlanType, BillingPlansQuery } from '@/graphql';
import { Label, Section } from '@/components/common';
import { Link, RadioGroup, Radio } from '@/components/v2';

const comingSoon = <span className="text-xs">(coming soon)</span>;

const planCollection: {
  [key in BillingPlanType]: {
    description: string;
    features: Array<React.ReactNode | string>;
    footer?: React.ReactNode;
  };
} = {
  [BillingPlanType.Hobby]: {
    description: 'For personal or small projects',
    features: [
      'Unlimited seats',
      '1M operations',
      '50 schema pushes',
      'Schema Registry',
      'Detection of breaking changes based on usage reports',
      'GitHub and Slack integrations',
      '3 days of usage data retention',
    ],
  },
  [BillingPlanType.Pro]: {
    description: 'For growing teams',
    features: [
      'Unlimited seats',
      '5M operations',
      '500 schema pushes',
      'Schema Registry',
      'Detection of breaking changes based on usage reports',
      'GitHub and Slack integrations',
      '90 days of usage data retention',
      <div>Schema Policy Checks {comingSoon}</div>,
      <div>ESLint integration {comingSoon}</div>,
    ],
    footer: (
      <>
        <div className="mb-2 text-sm font-bold">Free 14-day trial period</div>
        <div>$15 for additional 1M operations</div>
        <div>$1 for additional 10 schema pushes</div>
      </>
    ),
  },
  [BillingPlanType.Enterprise]: {
    description: 'Custom plan for large companies',
    features: [
      'Unlimited seats',
      'Unlimited operations',
      'Unlimited schema pushes',
      'Schema Registry',
      'Detection of breaking changes based on usage reports',
      'GitHub and Slack integrations',
      '360 days of usage data retention',
      <div>Schema Policy Checks {comingSoon}</div>,
      <div>ESLint integration {comingSoon}</div>,
      'SAML (coming soon)',
      <span className="flex gap-1">
        Support from
        <Link variant="primary" href="https://the-guild.dev" target="_blank" rel="noreferrer">
          The Guild
        </Link>
      </span>,
    ],
    footer: <>Shape a custom plan for your business</>,
  },
};

const Plan: React.FC<{
  isActive: boolean;
  name: string;
  price: string | number;
  description: string;
  features: React.ReactNode[];
  footer?: React.ReactNode;
}> = plan => {
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
              {'$'}
              {plan.price}
              <span className="text-sm text-gray-500">/mo</span>
            </>
          )}
        </div>
        <div className="text-sm text-gray-500">{plan.description}</div>
        <div>
          <List spacing={2} className="mt-6">
            {plan.features.map((feature, i) => {
              return (
                <ListItem key={i}>
                  <Section.Subtitle className="flex items-center">
                    <ListIcon color="gray.500" as={VscCheck} />
                    {feature}
                  </Section.Subtitle>
                </ListItem>
              );
            })}
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

export const BillingPlanPicker: React.FC<{
  value: BillingPlanType;
  activePlan: BillingPlanType;
  plans: BillingPlansQuery['billingPlans'];
  onPlanChange: (plan: BillingPlanType) => void;
}> = ({ value, activePlan, plans, onPlanChange }) => {
  return (
    <RadioGroup
      value={value}
      onValueChange={onPlanChange}
      className="flex !flex-row content-start	items-stretch justify-start !justify-items-start gap-4"
    >
      {plans.map(plan => {
        return (
          <Radio
            value={plan.planType}
            key={plan.id}
            className="block flex w-1/3 flex-col items-start !rounded-md border p-4"
          >
            <Plan
              key={plan.id}
              name={plan.name}
              price={
                plan.planType === BillingPlanType.Hobby
                  ? 'Free'
                  : plan.planType === BillingPlanType.Enterprise
                  ? 'Contact Us'
                  : plan.basePrice!
              }
              isActive={activePlan === plan.planType}
              features={planCollection[plan.planType].features}
              description={planCollection[plan.planType].description}
              footer={planCollection[plan.planType].footer}
            />
          </Radio>
        );
      })}
    </RadioGroup>
  );
};
