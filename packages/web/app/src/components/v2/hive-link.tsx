import { ReactElement } from 'react';
import clsx from 'clsx';
import { HiveLogo } from '@/components/v2/icon';
import { Link } from '@tanstack/react-router';

export const HiveLink = ({ className }: { className?: string }): ReactElement => {
  return (
    <Link href="/" className={clsx('inline-flex items-center', className)}>
      <HiveLogo />
    </Link>
  );
};
