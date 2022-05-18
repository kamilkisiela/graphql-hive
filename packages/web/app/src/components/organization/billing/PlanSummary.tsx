import { BillingPlansQuery, BillingPlanType } from '@/graphql';
import {
  Stat,
  StatGroup,
  StatHelpText,
  StatLabel,
  StatNumber,
  Table,
  TableContainer,
  Tbody,
  Td,
  Tfoot,
  Th,
  Thead,
  Tr,
} from '@chakra-ui/react';
import React from 'react';
import 'twin.macro';
import { CurrencyFormatter } from './helpers';

const PriceEstimationTable: React.FC<{
  plan: BillingPlansQuery['billingPlans'][number];
  operationsRateLimit: number;
  schemaPushesRateLimit: number;
}> = ({ plan, operationsRateLimit, schemaPushesRateLimit }) => {
  const includedOperationsInMillions = plan.includedOperationsLimit / 1_000_000;
  const additionalOperations = Math.max(
    0,
    operationsRateLimit - includedOperationsInMillions
  );
  const operationsTotal = plan.pricePerOperationsUnit * additionalOperations;
  const additionalSchemaPushes = Math.max(
    0,
    schemaPushesRateLimit - plan.includedSchemaPushLimit
  );
  const schemaTotal = plan.pricePerSchemaPushUnit * additionalSchemaPushes;
  const total = plan.basePrice + operationsTotal + schemaTotal;

  return (
    <TableContainer>
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
            <Td>Base price (unlimited seats)</Td>
            <Td isNumeric></Td>
            <Td isNumeric>{CurrencyFormatter.format(plan.basePrice)}</Td>
            <Td isNumeric>{CurrencyFormatter.format(plan.basePrice)}</Td>
          </Tr>
          <Tr>
            <Td>Monthly Operations (included)</Td>
            <Td isNumeric>{includedOperationsInMillions}M</Td>
            <Td isNumeric>{CurrencyFormatter.format(0)}</Td>
            <Td isNumeric>{CurrencyFormatter.format(0)}</Td>
          </Tr>
          {additionalOperations > 0 ? (
            <Tr>
              <Td>Monthly Operations (extra)</Td>
              <Td isNumeric>{additionalOperations}M</Td>
              <Td isNumeric>
                {CurrencyFormatter.format(plan.pricePerOperationsUnit)}
              </Td>
              <Td isNumeric>{CurrencyFormatter.format(operationsTotal)}</Td>
            </Tr>
          ) : null}
          <Tr>
            <Td>Monthly Schema Pushes (included)</Td>
            <Td isNumeric>{plan.includedSchemaPushLimit}</Td>
            <Td isNumeric>{CurrencyFormatter.format(0)}</Td>
            <Td isNumeric>{CurrencyFormatter.format(0)}</Td>
          </Tr>
          {additionalSchemaPushes > 0 ? (
            <Tr>
              <Td>Monthly Schema Pushes (extra)</Td>
              <Td isNumeric>{additionalSchemaPushes}</Td>
              <Td isNumeric>
                {CurrencyFormatter.format(plan.pricePerSchemaPushUnit)}
              </Td>
              <Td isNumeric>{CurrencyFormatter.format(schemaTotal)}</Td>
            </Tr>
          ) : null}
        </Tbody>
        <Tfoot>
          <Tr>
            <Th>TOTAL MONTHLY (AFTER TRIAL ENDS)</Th>
            <Th></Th>
            <Th></Th>
            <Th isNumeric>
              {total === 0 ? 'FREE' : CurrencyFormatter.format(total)}
            </Th>
          </Tr>
        </Tfoot>
      </Table>
    </TableContainer>
  );
};

export const PlanSummary: React.FC<{
  plan: BillingPlansQuery['billingPlans'][number];
  operationsRateLimit: number;
  schemaPushesRateLimit: number;
}> = ({ plan, operationsRateLimit, schemaPushesRateLimit, children }) => {
  if (plan.planType === BillingPlanType.Enterprise) {
    return (
      <>
        <Stat tw="mb-4">
          <StatLabel>Plan Type</StatLabel>
          <StatNumber>{plan.planType}</StatNumber>
        </Stat>
        <div tw="mb-6">
          Enterprise plan is for organizations that needs to ship and ingest
          large amount of data.
          <br />
          If you wish to upgrade to Enterprise, or you can't find the plan for
          you, please contact us and we'll find the right plan for your
          organization.
        </div>
      </>
    );
  }

  return (
    <>
      <StatGroup>
        <Stat tw="mb-4">
          <StatLabel>Plan Type</StatLabel>
          <StatNumber>{plan.planType}</StatNumber>
        </Stat>
        {children}
      </StatGroup>
      <PriceEstimationTable
        plan={plan}
        operationsRateLimit={operationsRateLimit}
        schemaPushesRateLimit={schemaPushesRateLimit}
      />
      <StatGroup tw="mt-8">
        <Stat>
          <StatLabel>Operations Limit</StatLabel>
          <StatHelpText>up to</StatHelpText>
          <StatNumber>
            {plan.planType === BillingPlanType.Hobby
              ? plan.includedOperationsLimit / 1_000_000
              : operationsRateLimit}
            M
          </StatNumber>
          <StatHelpText>per month</StatHelpText>
        </Stat>
        <Stat tw="mb-4">
          <StatLabel>Schema Pushes Limit</StatLabel>
          <StatHelpText>up to</StatHelpText>
          <StatNumber>
            {plan.planType === BillingPlanType.Hobby
              ? plan.includedSchemaPushLimit
              : schemaPushesRateLimit}
          </StatNumber>
          <StatHelpText>per month</StatHelpText>
        </Stat>
        <Stat tw="mb-4">
          <StatLabel>Retention</StatLabel>
          <StatNumber>{plan.retentionInDays} days</StatNumber>
        </Stat>
      </StatGroup>
    </>
  );
};
