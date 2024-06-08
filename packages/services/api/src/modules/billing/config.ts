export const USAGE_DEFAULT_LIMITATIONS: Record<
  'HOBBY' | 'PRO' | 'ENTERPRISE',
  { operations: number; retention: number }
> = {
  HOBBY: {
    operations: 1_000_000,
    retention: 7,
  },
  PRO: {
    operations: 0,
    retention: 90,
  },
  ENTERPRISE: {
    operations: 0, // unlimited
    retention: 365,
  },
};
