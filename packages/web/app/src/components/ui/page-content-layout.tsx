import { forwardRef, HTMLAttributes, ReactNode } from 'react';
import { DocsLink, DocsLinkProps } from '@/components/ui/docs-note';
import { cn } from '@/lib/utils';
import * as styles from './page-content-layout.css';

const PageLayout = ({ children }: { children: ReactNode }) => (
  <div className={styles.pageLayoutDiv}>
    <div className={styles.pageLayoutDiv2}>{children}</div>
  </div>
);
PageLayout.displayName = 'PageLayout';

type PageLayoutContentProps = {
  children: ReactNode;
  mainTitlePage?: string;
} & HTMLAttributes<HTMLDivElement>;

const PageLayoutContent = forwardRef<HTMLDivElement, PageLayoutContentProps>(
  ({ children, mainTitlePage, ...props }, ref) => (
    <div ref={ref} className={cn(styles.div, props.className)} {...props}>
      {mainTitlePage ? (
        <>
          <h1 className={styles.h1}>{mainTitlePage}</h1>
          <div className={styles.div2} />
        </>
      ) : null}
      {children}
    </div>
  ),
);
PageLayoutContent.displayName = 'PageLayoutContent';

const SubPageLayout = ({
  children,
  'data-cy': dataCy,
}: {
  children: ReactNode;
  'data-cy'?: string;
}) => (
  <div className={styles.subPageLayoutDiv} data-cy={dataCy}>
    {children}
  </div>
);
SubPageLayout.displayName = 'SubPageLayout';

type SubPageLayoutHeaderProps = {
  subPageTitle?: ReactNode;
  description?: string | ReactNode;
  sideContent?: ReactNode;
  docsLink?: DocsLinkProps;
};

const SubPageLayoutHeader = ({
  description,
  docsLink,
  sideContent,
  subPageTitle,
}: SubPageLayoutHeaderProps) => {
  const header = (
    <div className={styles.subPageLayoutHeaderDiv}>
      <h3 className={styles.subPageLayoutHeaderH3}>{subPageTitle}</h3>
      {typeof description === 'string' ? <p>{description}</p> : description}
      {docsLink && <DocsLink {...docsLink} />}
    </div>
  );
  return (
    <div className={styles.subPageLayoutHeaderDiv2}>
      {sideContent ? (
        <div className={styles.subPageLayoutHeaderDiv3}>
          {header}
          <div className={styles.subPageLayoutHeaderDiv4}>{sideContent}</div>
        </div>
      ) : (
        header
      )}
    </div>
  );
};

SubPageLayoutHeader.displayName = 'SubPageLayoutHeader';

export { PageLayout, PageLayoutContent, SubPageLayout, SubPageLayoutHeader };
