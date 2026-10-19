import { ReactElement, ReactNode } from 'react';
import magnifier from '../../../public/images/figures/magnifier.svg?url';
import { Card } from '@/components/ui/primitives/card/card';
import { ProjectType } from '@/gql/graphql';
import { cn } from '@/lib/utils';
import { Code } from './code';
import { DocsLink } from './docs-note';
import { Heading } from './heading';
import * as styles from './empty-list.css';

export const EmptyList = ({
  title,
  description,
  docsUrl,
  className,
  children,
}: {
  title: string;
  description: string;
  docsUrl?: string | null;
  children?: ReactNode | null;
  className?: string;
}): ReactElement => {
  return (
    <div className={cn(styles.emptyListDiv, className)}>
      <Card variants={{ onSurface: 'raised', bodyPadding: 'none' }}>
        <div className={styles.emptyListDiv2}>
          <img
            src={magnifier}
            alt="Magnifier illustration"
            width="200"
            height="200"
            className="drag-none"
          />
          <Heading className={styles.emptyListHeading}>{title}</Heading>
          <span className={styles.emptyListSpan}>{description}</span>
          <div className={styles.emptyListDiv3}>{children}</div>
          {docsUrl && (
            <div className={styles.emptyListDiv4}>
              <DocsLink href={docsUrl} text="Read more in the documentation" />
            </div>
          )}
        </div>
      </Card>
    </div>
  );
};

export const noSchema = (
  <EmptyList
    title="Schema Registry contains no schema"
    description="You can publish a schema with Hive CLI and Hive Client"
    docsUrl="/schema-registry#publish-a-schema"
  />
);

export const NoSchemaVersion = ({
  projectType = null,
  recommendedAction = 'none',
}: {
  projectType: ProjectType | null;
  recommendedAction: 'publish' | 'check' | 'none';
}): ReactElement => {
  let children: ReactElement | null = null;
  if (recommendedAction !== 'none') {
    const isDistributed =
      projectType === ProjectType.Federation || projectType === ProjectType.Stitching;

    if (recommendedAction === 'check') {
      children = (
        <>
          <div className={styles.noSchemaVersionDiv}>
            It's recommended to check that the schema is valid and compatible with the state of the
            registry before publishing.
          </div>
          <div className={styles.noSchemaVersionDiv2}>
            <Code>
              {`hive schema:check ${isDistributed ? '--service <service-name> --url <url> ' : ''} --target "<org>/<project>/<target>" <path/schema.graphql>`}
            </Code>
          </div>
        </>
      );
    } else if (recommendedAction === 'publish') {
      children = (
        <>
          {isDistributed && (
            <div className={styles.noSchemaVersionDiv3}>
              For distributed systems, it's recommended to publish the schema after the service is
              deployed.
            </div>
          )}
          <div className={styles.noSchemaVersionDiv4}>
            <Code>
              {`hive schema:publish ${isDistributed ? '--service <service-name> --url <url> ' : ''} --target "<org>/<project>/<target>" <path/schema.graphql>`}
            </Code>
          </div>
        </>
      );
    }
  }

  return (
    <EmptyList
      title="Hive is waiting for your first schema"
      description="You can publish a schema with Hive CLI and Hive Client"
      docsUrl={
        recommendedAction === 'publish' ? '/features/schema-registry#publish-a-schema' : undefined
      }
    >
      {children}
    </EmptyList>
  );
};

export const noValidSchemaVersion = (
  <EmptyList
    title="Hive is waiting for your first composable schema version"
    description="You can publish a schema with Hive CLI and Hive Client"
    docsUrl="/schema-registry#publish-a-schema"
  />
);
