import { ReactElement } from 'react';
import clsx from 'clsx';
import { HiveLogo } from '@/components/ui/brand-icon';
import { Link } from '@tanstack/react-router';
import * as styles from './hive-link.css';

export const HiveLink = ({ className }: { className?: string }): ReactElement => {
  return (
    <Link to="/" className={clsx(styles.hiveLinkLink, className)}>
      <HiveLogo />
    </Link>
  );
};
