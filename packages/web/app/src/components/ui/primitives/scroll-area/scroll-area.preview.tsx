import { controlsFor, createPreview, type NavPath } from 'react-foundry';
import { ScrollArea } from './scroll-area';
import * as styles from './scroll-area.preview.css';

export const nav: NavPath = 'Primitives/ScrollArea';

const OPERATIONS = [
  'MemberRoleAssignmentAuditLogByOrganizationSlug',
  'CDNAccessTokenRotationQuery',
  'SchemaContractCompositionValidationList',
  'SchemaRegistryExplorerTypeDetailsForDateRangeComparison',
  'SchemaContractCompositionValidationWithPaginationAndFilters',
  'SyncByOrganizationSlug',
  'GraphQLEndpointLatencyPercentilesForDateRangeComparison',
  'DashboardSummary',
  'DashboardGet',
  'MemberRoleAssignmentAuditLogWithPaginationAndFilters',
  'ProjectAccessTokenPermissionsManagementFetch',
  'PersistedOperationCollectionSyncFetch',
  'Compare',
];

function Rows(props: { count?: number }) {
  const rows = Array.from(
    { length: props.count ?? OPERATIONS.length },
    (_, i) => OPERATIONS[i % OPERATIONS.length],
  );
  return (
    <div className={styles.rowsDiv}>
      {rows.map((name, index) => (
        <div key={index} className={styles.rowsDiv2}>
          <span className={styles.rowsSpan}>{name}</span>
          <span className={styles.rowsSpan2}>{(index * 37) % 1000}</span>
        </div>
      ))}
    </div>
  );
}

/**
 * A scroll container with an overlaid scrollbar that is only drawn while the pointer is over the
 * area or it is moving. Hover each to see it. Heights are a scale (160, 240, 360px) rather than
 * arbitrary values: the three sites that were 176, 250 and 400px snap to the nearest step.
 */
export const Heights = createPreview(() => (
  <div className={styles.div}>
    {(['sm', 'md', 'lg'] as const).map(height => (
      <div key={height} className={styles.div2}>
        <ScrollArea height={height}>
          <Rows count={30} />
        </ScrollArea>
      </div>
    ))}
  </div>
));

/** `maxHeight` only scrolls once the content is taller than the step; short content sits flush. */
export const MaxHeight = createPreview(() => (
  <div className={styles.div3}>
    <div className={styles.div4}>
      <ScrollArea maxHeight="sm">
        <Rows count={3} />
      </ScrollArea>
    </div>
    <div className={styles.div5}>
      <ScrollArea maxHeight="sm">
        <Rows count={30} />
      </ScrollArea>
    </div>
  </div>
));

/** `fill` takes what is left of a flex column: a header, then a list that scrolls to the bottom edge. */
export const Fill = createPreview(() => (
  <div className={styles.div6}>
    <div className={styles.div7}>Span attributes</div>
    <ScrollArea fill>
      <div className={styles.div8}>
        <Rows count={30} />
      </div>
    </ScrollArea>
  </div>
));

const WIDE = OPERATIONS.join('  ');

export const Horizontal = createPreview(() => (
  <div className={styles.div9}>
    <ScrollArea axis="horizontal">
      <pre className={styles.pre}>
        {WIDE}
        {'\n'}
        {WIDE}
      </pre>
    </ScrollArea>
  </div>
));

export const Both = createPreview(() => (
  <div className={styles.div10}>
    <ScrollArea axis="both" height="sm">
      <pre className={styles.pre2}>{Array.from({ length: 30 }, () => WIDE).join('\n')}</pre>
    </ScrollArea>
  </div>
));

/** Row count against the height steps, to find where each one starts scrolling. */
export const Playground = createPreview({
  controls: controlsFor(ScrollArea, {
    children: {
      type: 'range',
      label: 'Rows',
      min: 1,
      max: 60,
      default: 30,
      derive: count => <Rows count={count} />,
    },
    height: {
      type: 'radio',
      options: ['unset', 'sm', 'md', 'lg'],
      default: 'sm',
      derive: step => (step === 'unset' ? undefined : step),
    },
    maxHeight: {
      type: 'radio',
      options: ['unset', 'sm', 'md', 'lg', 'screen'],
      default: 'unset',
      derive: step => (step === 'unset' ? undefined : step),
    },
  }),
  render: v => (
    <div className={styles.div11}>
      <ScrollArea height={v.height} maxHeight={v.maxHeight}>
        {v.children}
      </ScrollArea>
    </div>
  ),
});
