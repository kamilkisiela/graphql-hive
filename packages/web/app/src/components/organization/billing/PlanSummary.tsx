import { BillingPlansQuery, BillingPlanType } from '@/graphql';
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
import { ReactElement, ReactNode } from 'react';
import { CurrencyFormatter } from './helpers';

const PriceEstimationTable = ({
  plan,
  operationsRateLimit,
  schemaPushesRateLimit,
}: {
  plan: BillingPlansQuery['billingPlans'][number];
  operationsRateLimit: number;
  schemaPushesRateLimit: number;
}): ReactElement => {
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
          <Td isNumeric>{CurrencyFormatter.format(plan.basePrice)}</Td>
          <Td isNumeric>{CurrencyFormatter.format(plan.basePrice)}</Td>
        </Tr>
        <Tr>
          <Td>
            Included Operations <span className="text-gray-500">(free)</span>
          </Td>
          <Td isNumeric>{includedOperationsInMillions}M</Td>
          <Td isNumeric>{CurrencyFormatter.format(0)}</Td>
          <Td isNumeric>{CurrencyFormatter.format(0)}</Td>
        </Tr>
        <Tr>
          <Td>
            Included Schema Pushes <span className="text-gray-500">(free)</span>
          </Td>
          <Td isNumeric>{plan.includedSchemaPushLimit}</Td>
          <Td isNumeric>{CurrencyFormatter.format(0)}</Td>
          <Td isNumeric>{CurrencyFormatter.format(0)}</Td>
        </Tr>
        {plan.planType === BillingPlanType.Pro && (
          <Tr>
            <Td>Additional Operations</Td>
            <Td isNumeric>{additionalOperations}M</Td>
            <Td isNumeric>
              {CurrencyFormatter.format(plan.pricePerOperationsUnit)}
            </Td>
            <Td isNumeric>{CurrencyFormatter.format(operationsTotal)}</Td>
          </Tr>
        )}
        {plan.planType === BillingPlanType.Pro && (
          <Tr>
            <Td>Additional Schema Pushes</Td>
            <Td isNumeric>{additionalSchemaPushes}</Td>
            <Td isNumeric>
              {CurrencyFormatter.format(plan.pricePerSchemaPushUnit)}
            </Td>
            <Td isNumeric>{CurrencyFormatter.format(schemaTotal)}</Td>
          </Tr>
        )}
      </Tbody>
      <Tfoot>
        <Tr>
          <Th>TOTAL MONTHLY (AFTER TRIAL ENDS)</Th>
          <Th />
          <Th />
          <Th isNumeric>
            {total === 0 ? 'FREE' : CurrencyFormatter.format(total)}
          </Th>
        </Tr>
      </Tfoot>
    </Table>
  );
};

export const PlanSummary = ({
  plan,
  operationsRateLimit,
  schemaPushesRateLimit,
  children,
}: {
  plan: BillingPlansQuery['billingPlans'][number];
  operationsRateLimit: number;
  schemaPushesRateLimit: number;
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
          <StatLabel>Schema Pushes Limit</StatLabel>
          <StatHelpText>up to</StatHelpText>
          <StatNumber>{schemaPushesRateLimit}</StatNumber>
          <StatHelpText>per month</StatHelpText>
        </Stat>
        <Stat className="mb-8">
          <StatLabel>Retention</StatLabel>
          <StatHelpText>usage reports</StatHelpText>
          <StatNumber>{plan.retentionInDays} days</StatNumber>
        </Stat>
      </StatGroup>
      <PriceEstimationTable
        plan={plan}
        operationsRateLimit={operationsRateLimit}
        schemaPushesRateLimit={schemaPushesRateLimit}
      />
    </>
  );
};
