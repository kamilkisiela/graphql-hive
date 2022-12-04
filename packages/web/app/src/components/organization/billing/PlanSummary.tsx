import { ReactElement, ReactNode } from 'react';
import {
  Stat,
  StatGroup,
  StatHelpText,
  StatLabel,
  StatNumber,
  Table,
  Tbody,
  Td,
  Tfoot,
  Th,
  Thead,
  Tr,
} from '@chakra-ui/react';
import { BillingPlansQuery, BillingPlanType } from '@/graphql';
import { CurrencyFormatter } from './helpers';

const PriceEstimationTable = ({
  plan,
  operationsRateLimit,
}: {
  plan: BillingPlansQuery['billingPlans'][number];
  operationsRateLimit: number;
}): ReactElement => {
  const includedOperationsInMillions = (plan.includedOperationsLimit ?? 0) / 1_000_000;
  const additionalOperations = Math.max(0, operationsRateLimit - includedOperationsInMillions);
  const operationsTotal = (plan.pricePerOperationsUnit ?? 0) * additionalOperations;
  const total = (plan.basePrice ?? 0) + operationsTotal;

  return (
    <Table size="sm">
      <Thead>
        <Tr>
          <Th>Feature</Th>
          <Th isNumeric>Units</Th>
          <Th isNumeric>Unit Price</Th>
          <Th isNumeric>Total</Th>
        </Tr>
      </Thead>
      <Tbody>
        <Tr>
          <Td>
            Base price <span className="text-gray-500">(unlimited seats)</span>
          </Td>
          <Td isNumeric />
          <Td isNumeric>{CurrencyFormatter.format(plan.basePrice ?? 0)}</Td>
          <Td isNumeric>{CurrencyFormatter.format(plan.basePrice ?? 0)}</Td>
        </Tr>
        {includedOperationsInMillions > 0 ? (
          <Tr>
            <Td>
              Included Operations <span className="text-gray-500">(free)</span>
            </Td>
            <Td isNumeric>{includedOperationsInMillions}M</Td>
            <Td isNumeric>{CurrencyFormatter.format(0)}</Td>
            <Td isNumeric>{CurrencyFormatter.format(0)}</Td>
          </Tr>
        ) : null}
        {plan.planType === BillingPlanType.Pro && (
          <Tr>
            <Td>Operations</Td>
            <Td isNumeric>{additionalOperations}M</Td>
            <Td isNumeric>{CurrencyFormatter.format(plan.pricePerOperationsUnit ?? 0)}</Td>
            <Td isNumeric>{CurrencyFormatter.format(operationsTotal)}</Td>
          </Tr>
        )}
      </Tbody>
      <Tfoot>
        <Tr>
          <Th>TOTAL MONTHLY (AFTER TRIAL ENDS)</Th>
          <Th />
          <Th />
          <Th isNumeric>{total === 0 ? 'FREE' : CurrencyFormatter.format(total)}</Th>
        </Tr>
      </Tfoot>
    </Table>
  );
};

export const PlanSummary = ({
  plan,
  operationsRateLimit,
  retentionInDays,
  children,
}: {
  plan: BillingPlansQuery['billingPlans'][number];
  operationsRateLimit: number;
  retentionInDays: number;
  children: ReactNode;
}): ReactElement => {
  if (plan.planType === BillingPlanType.Enterprise) {
    return (
      <>
        <Stat className="mb-4">
          <StatLabel>Plan Type</StatLabel>
          <StatNumber>{plan.planType}</StatNumber>
        </Stat>
        <div className="mb-6">
          Enterprise plan is for organizations that needs to ship and ingest large amount of data.
          <br />
          If you wish to upgrade to Enterprise, or you can't find the plan for you, please contact
          us and we'll find the right plan for your organization.
        </div>
      </>
    );
  }

  return (
    <>
      <StatGroup>
        <Stat className="mb-8">
          <StatLabel>Plan Type</StatLabel>
          <StatNumber>{plan.planType}</StatNumber>
        </Stat>
        {children}
        <Stat>
          <StatLabel>Operations Limit</StatLabel>
          <StatHelpText>up to</StatHelpText>
          <StatNumber>{operationsRateLimit}M</StatNumber>
          <StatHelpText>per month</StatHelpText>
        </Stat>
        <Stat className="mb-8">
          <StatLabel>Retention</StatLabel>
          <StatHelpText>usage reports</StatHelpText>
          <StatNumber>{retentionInDays} days</StatNumber>
        </Stat>
      </StatGroup>
      <PriceEstimationTable plan={plan} operationsRateLimit={operationsRateLimit} />
    </>
  );
};
