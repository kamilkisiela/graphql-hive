import type { ReactNode } from 'react';
import { DocsLink, type DocsLinkProps } from '@/components/ui/docs-note';
import * as styles from './page-lead.css';

export function PageLead({
  description,
  docsLink,
  title,
  titleAccessory,
}: {
  description: string;
  docsLink?: DocsLinkProps;
  title: string;
  /**
   * Optional element rendered to the right of the title (usage chip,
   * status badge, etc.). Aligned vertically center with the title; flows
   * inline rather than breaking onto its own row.
   */
  titleAccessory?: ReactNode;
}) {
  return (
    <div className={styles.pageLeadDiv}>
      <div className={styles.pageLeadDiv2}>
        <h1 className={styles.pageLeadH1}>{title}</h1>
        {titleAccessory}
      </div>
      <p className={styles.pageLeadP}>{description}</p>
      {docsLink && (
        <div className={styles.pageLeadDiv3}>
          <DocsLink {...docsLink} />
        </div>
      )}
    </div>
  );
}
