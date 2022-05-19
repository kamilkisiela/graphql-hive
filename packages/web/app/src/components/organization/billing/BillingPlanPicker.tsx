import React from 'react';
import 'twin.macro';
import { List, ListIcon, ListItem } from '@chakra-ui/react';
import {
  VscAdd,
  VscBell,
  VscCheck,
  VscClearAll,
  VscKey,
  VscPerson,
  VscTable,
} from 'react-icons/vsc';
import {
  BillingPlansQuery,
  BillingPlanType,
  UsageRateLimitType,
} from '@/graphql';
import { Label, Section } from '@/components/common';
import { Link, Radio, RadioGroup } from '@/components/v2';
import { CurrencyFormatter, NumericFormater } from './helpers';
import { Logo } from '@/components/common/Logo';

export const BillingPlanPicker: React.FC<{
  value: BillingPlanType;
  activePlan: BillingPlanType;
  plans: BillingPlansQuery['billingPlans'];
  onPlanChange: (plan: BillingPlanType) => void;
}> = ({ value, activePlan, plans, onPlanChange }) => {
  return (
    <RadioGroup value={value} onValueChange={onPlanChange}>
      {plans.map((plan) => (
        <Radio key={plan.id} value={plan.planType} className="px-3 py-2">
          <Section.BigTitle className="flex items-center gap-2">
            {plan.name}
            {activePlan === plan.planType && <Label>CURRENT PLAN</Label>}
          </Section.BigTitle>
          <Label>
            {plan.basePrice
              ? `STARTS AT ${CurrencyFormatter.format(
                  plan.basePrice
                )} / MONTH + RESERVED VOLUME`
              : plan.planType === 'ENTERPRISE'
              ? 'Contact Us'
              : 'FREE'}
          </Label>
          <Section.Subtitle>{plan.description}</Section.Subtitle>
          <div>
            <List spacing={2} tw="mt-2">
              {plan.planType === BillingPlanType.Pro && (
                <ListItem>
                  <Section.Subtitle className="flex items-center">
                    <ListIcon as={VscCheck} />
                    14 days free trial
                  </Section.Subtitle>
                </ListItem>
              )}
              <ListItem>
                <Section.Subtitle className="flex items-center">
                  <ListIcon as={VscCheck} />
                  {!plan.includedOperationsLimit
                    ? 'Unlimited'
                    : NumericFormater.format(plan.includedOperationsLimit)}
                  {plan.rateLimit === UsageRateLimitType.MonthlyLimited
                    ? ' '
                    : '+ '}
                  operations per month
                  {Boolean(plan.pricePerOperationsUnit) &&
                    ` included in base price + 
                        ${CurrencyFormatter.format(
                          plan.pricePerOperationsUnit
                        )} 
                        per 1M`}
                </Section.Subtitle>
              </ListItem>
              <ListItem>
                <Section.Subtitle className="flex items-center">
                  <ListIcon as={VscCheck} />
                  {plan.includedSchemaPushLimit
                    ? NumericFormater.format(plan.includedSchemaPushLimit)
                    : 'Unlimited'}
                  {plan.rateLimit === UsageRateLimitType.MonthlyLimited
                    ? ' '
                    : '+ '}
                  schema pushes per month
                  {Boolean(plan.pricePerSchemaPushUnit) &&
                    ` included in base price + 
                        ${CurrencyFormatter.format(
                          plan.pricePerSchemaPushUnit
                        )} per additional schema`}
                </Section.Subtitle>
              </ListItem>
              {plan.planType === BillingPlanType.Hobby ? (
                <>
                  <ListItem>
                    <Section.Subtitle className="flex items-center">
                      <ListIcon as={VscCheck} />
                      GraphQL Schema Registry
                    </Section.Subtitle>
                  </ListItem>
                  <ListItem>
                    <Section.Subtitle className="flex items-center">
                      <ListIcon as={VscPerson} />
                      Unlimited seats and collaborators
                    </Section.Subtitle>
                  </ListItem>
                  <ListItem>
                    <Section.Subtitle className="flex items-center">
                      <ListIcon as={VscCheck} />
                      Breaking changes checks with usage-based monitoring
                    </Section.Subtitle>
                  </ListItem>
                  <ListItem>
                    <Section.Subtitle className="flex items-center">
                      <ListIcon as={VscBell} />
                      Alerts & Slack integration
                    </Section.Subtitle>
                  </ListItem>
                </>
              ) : (
                <ListItem>
                  <Section.Subtitle className="flex items-center">
                    <ListIcon as={VscAdd} />
                    All features from Hobby
                    {plan.planType === BillingPlanType.Enterprise && ' and Pro'}
                    , including:
                  </Section.Subtitle>
                </ListItem>
              )}
              <ListItem>
                <Section.Subtitle className="flex items-center">
                  <ListIcon as={VscCheck} />
                  {plan.retentionInDays
                    ? `${plan.retentionInDays} days`
                    : 'Unlimited'}{' '}
                  retention
                </Section.Subtitle>
              </ListItem>
              {plan.planType === BillingPlanType.Pro && (
                <>
                  <ListItem>
                    <Section.Subtitle className="flex items-center">
                      <ListIcon as={VscTable} />
                      GraphQL Schema Policy Checks
                      <Label className="ml-2">COMING SOON</Label>
                    </Section.Subtitle>
                  </ListItem>
                  <ListItem>
                    <Section.Subtitle className="flex items-center">
                      <ListIcon as={VscClearAll} />
                      GraphQL-ESLint Integration
                      <Label className="ml-2">COMING SOON</Label>
                    </Section.Subtitle>
                  </ListItem>
                </>
              )}
              {plan.planType === BillingPlanType.Enterprise && (
                <>
                  <ListItem>
                    <Section.Subtitle className="flex items-center">
                      <ListIcon as={VscKey} />
                      SAML<Label className="ml-2">COMING SOON</Label>
                    </Section.Subtitle>
                  </ListItem>
                  <ListItem>
                    <Section.Subtitle className="flex items-center">
                      <ListIcon as={Logo} />
                      <span>
                        Schema design review and GraphQL support from{' '}
                        <Link
                          variant="primary"
                          href="https://the-guild.dev"
                          target="_blank"
                          rel="noreferrer"
                        >
                          The Guild
                        </Link>
                      </span>
                    </Section.Subtitle>
                  </ListItem>
                </>
              )}
            </List>
          </div>
        </Radio>
      ))}
    </RadioGroup>
  );
};
