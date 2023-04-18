import { ReactElement, ReactNode } from 'react';
import { Stat, Table, TBody, Td, TFoot, Th, THead, Tr } from '@/components/v2';
import { FragmentType, graphql, useFragment } from '@/gql';
import { BillingPlanType } from '@/graphql';
import { CurrencyFormatter } from './helpers';

const PriceEstimationTable_PlanFragment = graphql(`
  fragment PriceEstimationTable_PlanFragment on BillingPlan {
    includedOperationsLimit
    pricePerOperationsUnit
    basePrice
    planType
  }
`);

function PriceEstimationTable(props: {
  plan: FragmentType<typeof PriceEstimationTable_PlanFragment>;
  operationsRateLimit: number;
}): ReactElement {
  const plan = useFragment(PriceEstimationTable_PlanFragment, props.plan);
  const includedOperationsInMillions = (plan.includedOperationsLimit ?? 0) / 1_000_000;
  const additionalOperations = Math.max(
    0,
    props.operationsRateLimit - includedOperationsInMillions,
  );
  const operationsTotal = (plan.pricePerOperationsUnit ?? 0) * additionalOperations;
  const total = (plan.basePrice ?? 0) + operationsTotal;

  return (
    <Table>
      <THead>
        <Th>Feature</Th>
        <Th align="right">Units</Th>
        <Th align="right">Unit Price</Th>
        <Th align="right">Total</Th>
      </THead>
      <TBody>
        <Tr>
          <Td>
            Base price <span className="text-gray-500">(unlimited seats)</span>
          </Td>
          <Td align="right" />
          <Td align="right">{CurrencyFormatter.format(plan.basePrice ?? 0)}</Td>
          <Td align="right">{CurrencyFormatter.format(plan.basePrice ?? 0)}</Td>
        </Tr>
        {includedOperationsInMillions > 0 && (
          <Tr>
            <Td>
              Included Operations <span className="text-gray-500">(free)</span>
            </Td>
            <Td align="right">{includedOperationsInMillions}M</Td>
            <Td align="right">{CurrencyFormatter.format(0)}</Td>
            <Td align="right">{CurrencyFormatter.format(0)}</Td>
          </Tr>
        )}
        {plan.planType === BillingPlanType.Pro && (
          <Tr>
            <Td>Operations</Td>
            <Td align="right">{additionalOperations}M</Td>
            <Td align="right">{CurrencyFormatter.format(plan.pricePerOperationsUnit ?? 0)}</Td>
            <Td align="right">{CurrencyFormatter.format(operationsTotal)}</Td>
          </Tr>
        )}
      </TBody>
      <TFoot>
        <Th>Total monthly</Th>
        <Th align="right">{total === 0 ? 'FREE' : CurrencyFormatter.format(total)}</Th>
      </TFoot>
    </Table>
  );
}

const PlanSummary_PlanFragment = graphql(`
  fragment PlanSummary_PlanFragment on BillingPlan {
    planType
    retentionInDays
    ...PriceEstimationTable_PlanFragment
  }
`);

export function PlanSummary({
  operationsRateLimit,
  children,
  ...props
}: {
  plan: FragmentType<typeof PlanSummary_PlanFragment>;
  operationsRateLimit: number;
  children?: ReactNode;
}): ReactElement {
  const plan = useFragment(PlanSummary_PlanFragment, props.plan);
  if (plan.planType === BillingPlanType.Enterprise) {
    return (
      <Stat>
        <Stat.Label>Plan Type</Stat.Label>
        <Stat.Number>{plan.planType}</Stat.Number>
        <Stat.HelpText>
          Enterprise plan is for organizations that needs to ship and ingest large amount of data,
          and needs ongoing support around GraphQL APIs.
        </Stat.HelpText>
      </Stat>
    );
  }

  return (
    <>
      <div className="flex gap-32">
        <Stat className="mb-8">
          <Stat.Label>Plan Type</Stat.Label>
          <Stat.Number>{plan.planType}</Stat.Number>
        </Stat>

        {children}

        <Stat>
          <Stat.Label>Operations Limit</Stat.Label>
          <Stat.HelpText>up to</Stat.HelpText>
          <Stat.Number>{operationsRateLimit}M</Stat.Number>
          <Stat.HelpText>per month</Stat.HelpText>
        </Stat>
        <Stat className="mb-8">
          <Stat.Label>Retention</Stat.Label>
          <Stat.HelpText>usage reports</Stat.HelpText>
          <Stat.Number>{plan.retentionInDays} days</Stat.Number>
        </Stat>
      </div>
      <PriceEstimationTable plan={plan} operationsRateLimit={operationsRateLimit} />
    </>
  );
}
