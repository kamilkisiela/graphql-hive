import { USAGE_DEFAULT_LIMITATIONS } from '../../constants';
import { BillingProvider } from '../../providers/billing.provider';
import type { QueryResolvers } from './../../../../__generated__/types.next';

export const billingPlans: NonNullable<QueryResolvers['billingPlans']> = async (
  _,
  __,
  { injector },
) => {
  const availablePrices = await injector.get(BillingProvider).getAvailablePrices();

  if (!availablePrices) {
    return [];
  }

  return [
    {
      id: 'HOBBY',
      planType: 'HOBBY',
      basePrice: 0,
      name: 'Hobby',
      description: 'Free for non-commercial use, startups, side-projects and just experiments.',
      includedOperationsLimit: USAGE_DEFAULT_LIMITATIONS.HOBBY.operations,
      rateLimit: 'MONTHLY_LIMITED',
      pricePerOperationsUnit: 0,
      retentionInDays: USAGE_DEFAULT_LIMITATIONS.HOBBY.retention,
    },
    {
      id: 'PRO',
      planType: 'PRO',
      basePrice: availablePrices.basePrice.unit_amount! / 100,
      name: 'Pro',
      description:
        'For production-ready applications that requires long retention, high ingestion capacity.',
      includedOperationsLimit: USAGE_DEFAULT_LIMITATIONS.PRO.operations,
      pricePerOperationsUnit: availablePrices.operationsPrice.tiers![1].unit_amount! / 100,
      retentionInDays: USAGE_DEFAULT_LIMITATIONS.PRO.retention,
      rateLimit: 'MONTHLY_QUOTA',
    },
    {
      id: 'ENTERPRISE',
      planType: 'ENTERPRISE',
      name: 'Enterprise',
      description:
        'For enterprise and organization that requires custom setup and custom data ingestion rates.',
      includedOperationsLimit: USAGE_DEFAULT_LIMITATIONS.ENTERPRISE.operations,
      retentionInDays: USAGE_DEFAULT_LIMITATIONS.ENTERPRISE.retention,
      rateLimit: 'UNLIMITED',
    },
  ];
};
