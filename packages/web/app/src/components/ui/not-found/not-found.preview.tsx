import { controlsFor, createPreview, type NavPath } from 'react-foundry';
import { NotFound } from './not-found';
import * as styles from './not-found.preview.css';

export const nav: NavPath = 'Components/NotFound';

/**
 * The centred layout, which is what seven of the eight existing call sites use. Sits inside a
 * page layout and fills the content region, so it is given a bounded box here rather than the
 * whole canvas.
 */
export const Default = createPreview(() => (
  <div className={styles.div}>
    <NotFound
      title="Schema Version not found."
      description="This schema version does not seem to exist anymore."
    />
  </div>
));

/** Without the back button, the shape the organization layout uses. */
export const WithoutBackButton = createPreview(() => (
  <div className={styles.div2}>
    <NotFound
      title="Organization not found"
      description="Use the empty dropdown in the header to select an organization to which you have access."
      showBackButton={false}
    />
  </div>
));

/**
 * `bigHeading` above the title, for the route-level 404. Paired with `fullScreen`, which is the
 * only combination that ships: it replaces the whole page rather than a layout's content region.
 */
export const BigHeading = createPreview(() => (
  <div className={styles.div3}>
    <NotFound bigHeading="404" title="Page Not Found" />
  </div>
));

/**
 * The horizontal layout with the `connection` illustration, which is what the project and target
 * layouts use for a missing resource. Stacks below the `sm` breakpoint, so narrow the canvas to
 * check that fallback.
 */
export const Horizontal = createPreview(() => (
  <div className={styles.div4}>
    <NotFound
      variants={{ layout: 'horizontal', illustration: 'connection' }}
      title="404 - This project does not seem to exist."
      description={
        <>
          <p>It seems like you do not have access to this resource or it does not exist.</p>
          <p>Please check again with your organization admin.</p>
        </>
      }
    />
  </div>
));

/** Horizontal at a narrow width, where it falls back to the stacked arrangement. */
export const HorizontalNarrow = createPreview(() => (
  <div className={styles.div5}>
    <NotFound
      variants={{ layout: 'horizontal', illustration: 'connection' }}
      title="404 - This project does not seem to exist."
      description={
        <>
          <p>It seems like you do not have access to this resource or it does not exist.</p>
          <p>Please check again with your organization admin.</p>
        </>
      }
    />
  </div>
));

/** Both illustrations side by side, since `connection` is only ever seen in horizontal today. */
export const Illustrations = createPreview(() => (
  <div className={styles.div6}>
    <div className={styles.div7}>
      <NotFound variants={{ illustration: 'ghost' }} title="ghost" showBackButton={false} />
    </div>
    <div className={styles.div8}>
      <NotFound
        variants={{ illustration: 'connection' }}
        title="connection"
        showBackButton={false}
      />
    </div>
  </div>
));

/** All eight call sites. The dashed box stands in for the region each one fills. */
export const AllCallSites = createPreview({
  label: 'All 8 call sites',
  render: () => (
    <div className={styles.div9}>
      {[
        {
          site: 'router.tsx — route-level 404 (fullScreen)',
          node: <NotFound bigHeading="404" title="Page Not Found" />,
        },
        {
          site: 'layouts/organization.tsx',
          node: (
            <NotFound
              title="Organization not found"
              description="Use the empty dropdown in the header to select an organization to which you have access."
              showBackButton={false}
            />
          ),
        },
        {
          site: 'target-trace.tsx',
          node: <NotFound title="Trace not found." description="This trace does not exist." />,
        },
        {
          site: 'target-app-version.tsx',
          node: (
            <NotFound
              title="App Version not found."
              description="This app does not seem to exist anymore."
            />
          ),
        },
        {
          site: 'target-history-schema-version.tsx',
          node: (
            <NotFound
              title="Schema Version not found."
              description="This schema version does not seem to exist anymore."
              showBackButton={false}
            />
          ),
        },
        {
          site: 'organization-support-ticket.tsx — was the card variant',
          node: (
            <NotFound
              title="Support ticket not found."
              description="The support ticket you are looking for does not exist or you do not have access to it."
            />
          ),
        },
        {
          site: 'layouts/project.tsx and layouts/target.tsx',
          node: (
            <NotFound
              variants={{ layout: 'horizontal', illustration: 'connection' }}
              title="404 - This project does not seem to exist."
              description={
                <>
                  <p>It seems like you do not have access to this resource or it does not exist.</p>
                  <p>Please check again with your organization admin.</p>
                </>
              }
            />
          ),
        },
        {
          site: 'target-alerts-detail.tsx',
          node: (
            <NotFound
              variants={{ layout: 'horizontal', illustration: 'connection' }}
              title="Alert rule not found"
              description={
                <>
                  <p>It seems like you do not have access to this resource or it does not exist.</p>
                  <p>Please check again with your organization admin.</p>
                </>
              }
            />
          ),
        },
      ].map(({ site, node }) => (
        <div key={site}>
          <p className={styles.p}>{site}</p>
          <div className={styles.div10}>{node}</div>
        </div>
      ))}
    </div>
  ),
});

export const Playground = createPreview({
  controls: controlsFor(NotFound, {
    variants: {
      layout: { type: 'radio', options: ['centered', 'horizontal'], default: 'centered' },
      illustration: { type: 'radio', options: ['ghost', 'connection'], default: 'ghost' },
      fullScreen: { type: 'boolean', default: false },
    },
    bigHeading: { type: 'text', default: '' },
    title: { type: 'text', default: 'Schema Version not found.' },
    description: { type: 'text', default: 'This schema version does not seem to exist anymore.' },
    showBackButton: { type: 'boolean', default: true },
  }),
  render: v => {
    const notFound = (
      <NotFound
        variants={v.variants}
        bigHeading={v.bigHeading || undefined}
        title={v.title}
        description={v.description || undefined}
        showBackButton={v.showBackButton}
      />
    );

    // `fullScreen` is `h-screen`, so boxing it in a fixed height is a contradiction: the component
    // would be taller than its container and centre its content below the visible area. Hand it
    // the canvas instead, which is the only honest way to show it.
    return v.variants?.fullScreen ? notFound : <div className={styles.div11}>{notFound}</div>;
  },
});
