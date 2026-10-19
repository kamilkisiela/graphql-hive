import { ReactElement } from 'react';
import { Book, ExternalLink, Megaphone } from 'lucide-react';
import { getDocsUrl, getProductUpdatesUrl } from '@/lib/docs-url';
import * as styles from './docs-note.css';

export type DocsLinkProps = {
  href: string;
  icon?: ReactElement;
  text: string;
};

export const DocsLink = ({ href, icon, text }: DocsLinkProps) => {
  const fullUrl = href.startsWith('http') ? href : getDocsUrl(href);

  return (
    <a href={fullUrl} target="_blank" rel="noreferrer" className={styles.docsLinkA}>
      {icon ?? <Book className={styles.docsLinkBook} />}
      {text}
      <ExternalLink className={styles.docsLinkExternalLink} />
    </a>
  );
};

export const ProductUpdatesLink = ({ href, text }: { href: string; text: string }) => {
  const fullUrl = href.startsWith('http') ? href : getProductUpdatesUrl(href);

  return (
    <a href={fullUrl} target="'_blank" rel="noreferrer" className={styles.productUpdatesLinkA}>
      <Megaphone className={styles.productUpdatesLinkMegaphone} />
      {text}
      <ExternalLink className={styles.productUpdatesLinkExternalLink} />
    </a>
  );
};
