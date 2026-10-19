import { controlsFor, createPreview, type NavPath } from 'react-foundry';
import { PageLead } from './page-lead';
import { Badge } from './primitives/badge/badge';
import { Button } from './primitives/button/button';
import * as styles from './page-lead.preview.css';

export const nav: NavPath = 'Components/PageLead';

export const Default = createPreview(() => (
  <div className={styles.div}>
    <PageLead
      title="Alerts"
      description="Get notified when your GraphQL API's traffic, errors, or latency cross a threshold."
    />
  </div>
));

/** `titleAccessory` flows inline with the title rather than onto its own row. */
export const WithBadge = createPreview(() => (
  <div className={styles.div2}>
    <PageLead
      title="Schema checks"
      description="Every check run against this target, newest first."
      titleAccessory={<Badge content="42 this month" variants={{ variant: 'secondary' }} />}
    />
  </div>
));

export const WithAction = createPreview(() => (
  <div className={styles.div3}>
    <PageLead
      title="Access tokens"
      description="Tokens let CI and the CLI publish schemas on your behalf."
      titleAccessory={<Button variant="primary">Create token</Button>}
    />
  </div>
));

export const WithDocsLink = createPreview(() => (
  <div className={styles.div4}>
    <PageLead
      title="App Deployments"
      description="Group your GraphQL operations by app version for app version statistics and persisted operations."
      docsLink={{
        href: '/schema-registry/app-deployments',
        text: 'Learn more about App Deployments',
      }}
    />
  </div>
));

export const LongDescription = createPreview(() => (
  <div className={styles.div5}>
    <PageLead
      title="Usage reporting"
      description="Hive aggregates every operation your gateway reports, so you can see which fields are actually used before you deprecate them. Reporting is sampled at the client and flushed in batches."
    />
  </div>
));

export const Playground = createPreview({
  controls: controlsFor(PageLead, {
    title: { type: 'text', default: 'Alerts' },
    description: {
      type: 'text',
      default: "Get notified when your API's traffic or latency crosses a threshold.",
    },
    titleAccessory: {
      type: 'radio',
      options: ['none', 'badge', 'button'],
      default: 'none',
      derive: kind =>
        kind === 'badge' ? (
          <Badge content="42 this month" variants={{ variant: 'secondary' }} />
        ) : kind === 'button' ? (
          <Button variant="primary">Create token</Button>
        ) : undefined,
    },
  }),
  render: v => (
    <div className={styles.div6}>
      <PageLead title={v.title} description={v.description} titleAccessory={v.titleAccessory} />
    </div>
  ),
});
