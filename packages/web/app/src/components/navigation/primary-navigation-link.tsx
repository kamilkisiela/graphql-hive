import { Link, LinkProps } from '@tanstack/react-router';
import * as styles from './primary-navigation-link.css';

type PrimaryNavigationLinkProps = {
  linkText: string;
  linkProps: Pick<LinkProps, 'to' | 'params'>;
};

export function PrimaryNavigationLink({ linkProps, linkText }: PrimaryNavigationLinkProps) {
  return (
    <Link to={linkProps.to} params={linkProps.params} className={styles.primaryNavigationLinkLink}>
      {linkText}
    </Link>
  );
}
