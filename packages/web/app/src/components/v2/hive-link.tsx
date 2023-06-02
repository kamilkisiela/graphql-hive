import { ReactElement } from 'react';
import NextLink from 'next/link';
import clsx from 'clsx';
import { HiveLogo } from '@/components/v2/icon';

export const HiveLink = ({ className }: { className?: string }): ReactElement => {
  return (
    <NextLink href="/" className={clsx('inline-flex items-center', className)}>
      <HiveLogo />
    </NextLink>
  );
};
