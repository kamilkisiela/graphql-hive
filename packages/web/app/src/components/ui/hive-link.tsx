import { ReactElement } from 'react';
import clsx from 'clsx';
import { Link } from '@tanstack/react-router';
import { HiveLogo } from './icon';

export const HiveLink = ({ className }: { className?: string }): ReactElement => {
  return (
    <Link to="/" className={clsx('inline-flex items-center', className)}>
      <HiveLogo />
    </Link>
  );
};
