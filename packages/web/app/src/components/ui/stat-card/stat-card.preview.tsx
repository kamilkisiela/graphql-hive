import {
  ActivityIcon,
  BookIcon,
  FrownIcon,
  GaugeIcon,
  GlobeIcon,
  PercentIcon,
  SmileIcon,
} from 'lucide-react';
import { controlsFor, createPreview, type NavPath } from 'react-foundry';
import { StatCard } from './stat-card';
import * as styles from './stat-card.preview.css';

export const nav: NavPath = 'Components/StatCard';

const ICONS = {
  globe: GlobeIcon,
  activity: ActivityIcon,
  percent: PercentIcon,
  gauge: GaugeIcon,
  book: BookIcon,
  smile: SmileIcon,
  frown: FrownIcon,
};

/** The shape all the insights stat cards share, always on a raised Card. */
export const Default = createPreview(() => (
  <StatCard title="Requests" icon={GlobeIcon} value="482,100" caption="Total requests served" />
));

/**
 * Success and failure rate are the only call sites that colour the title. Worth checking both
 * themes: emerald-500 and red-500 are fixed colours, so they do not shift with the surface.
 */
export const Tones = createPreview(() => (
  <div className={styles.div}>
    <StatCard
      title="Requests (default)"
      icon={GlobeIcon}
      value="482,100"
      caption="Total requests served"
    />
    <StatCard
      variants={{ tone: 'muted' }}
      title="Requests (muted)"
      icon={GlobeIcon}
      value="482,100"
      caption="Total requests served"
    />
    <StatCard
      variants={{ tone: 'success' }}
      title="Success rate"
      icon={SmileIcon}
      value="99.2%"
      caption="Successful requests in last 7 days"
    />
    <StatCard
      variants={{ tone: 'danger' }}
      title="Failure rate"
      icon={FrownIcon}
      value="0.8%"
      caption="Failed requests in last 7 days"
    />
  </div>
));

/** The manage-filters outlier: muted title, no icon, no caption. */
export const NoIconNoCaption = createPreview(() => (
  <StatCard variants={{ tone: 'muted' }} title="Total Filters" value="18" />
));

/** The coordinate page suffixes the figure with an error count, so `value` takes a node. */
export const NodeValue = createPreview(() => (
  <StatCard
    title="Total resolutions"
    icon={GlobeIcon}
    value={
      <>
        1,204,880
        <span className={styles.span}>(3,120 errors)</span>
      </>
    }
    caption="Resolved in last 7 days"
  />
));

/**
 * Replaces the raw HTML `title` attribute the coordinate page used for this. Matches the info-icon
 * pattern already in `components/target/insights/list.tsx` for the Impact column.
 */
export const WithHint = createPreview(() => (
  <StatCard
    title="Total resolutions"
    icon={GlobeIcon}
    hint={
      <>
        <p className={styles.p}>
          Resolution Count is the total number of times this specific field (schema coordinate) was
          executed and returned.
        </p>
        <p>
          This differs from Request Count because a single request can resolve a field multiple
          times (e.g. inside an array) or skip it entirely.
        </p>
      </>
    }
    value="1,204,880"
    caption="Resolved in last 7 days"
  />
));

/**
 * The narrowest column the insights grid produces (`lg:grid-cols-2` inside a `col-span-4`).
 * "Relative Request Frequency" wraps to two lines here, which is the case the icon has to survive.
 */
export const LongTitle = createPreview(() => (
  <div className={styles.div2}>
    <StatCard
      title="Relative Request Frequency"
      icon={PercentIcon}
      value="15.1%"
      caption="The impact on the overall API traffic"
    />
  </div>
));

/**
 * The full row from the insights page, so the tiles can be checked for a consistent baseline:
 * the value sits at the same height in every card regardless of whether the title wrapped.
 */
export const InsightsRow = createPreview(() => (
  <div className={styles.div3}>
    <StatCard title="Requests" icon={GlobeIcon} value="482,100" caption="Total requests served" />
    <StatCard
      title="Requests per minute"
      icon={ActivityIcon}
      value="1.2k"
      caption="Throughput in last 7 days"
    />
    <StatCard
      title="Relative Request Frequency"
      icon={PercentIcon}
      value="15.1%"
      caption="The impact on the overall API traffic"
    />
    <StatCard
      variants={{ tone: 'success' }}
      title="Success rate"
      icon={SmileIcon}
      value="99.2%"
      caption="Successful requests in last 7 days"
    />
    <StatCard title="p99" icon={GaugeIcon} value="284ms" caption="Latency p99 in last 7 days" />
    <StatCard title="p95" icon={GaugeIcon} value="190ms" caption="Latency p95 in last 7 days" />
    <StatCard
      title="Operations"
      icon={BookIcon}
      value="18"
      caption="Distinct GraphQL operations in last 7 days"
    />
    <StatCard
      variants={{ tone: 'danger' }}
      title="Failure rate"
      icon={FrownIcon}
      value="0.8%"
      caption="Failed requests in last 7 days"
    />
  </div>
));

export const Playground = createPreview({
  controls: controlsFor(StatCard, {
    variants: {
      tone: {
        type: 'radio',
        options: ['default', 'success', 'danger', 'muted'],
        default: 'default',
      },
    },
    title: { type: 'text', default: 'Requests' },
    icon: {
      type: 'select',
      options: ['none', 'globe', 'activity', 'percent', 'gauge', 'book', 'smile', 'frown'],
      default: 'globe',
      derive: name => (name === 'none' ? undefined : ICONS[name]),
    },
    value: { type: 'text', default: '482,100' },
    caption: { type: 'text', default: 'Total requests served' },
    // Text still exercises the length and wrapping of the tooltip; `WithHint` above covers the
    // node case.
    hint: { type: 'text', default: '' },
  }),
  render: v => (
    <StatCard
      variants={v.variants}
      title={v.title}
      icon={v.icon}
      value={v.value}
      caption={v.caption}
      hint={v.hint}
    />
  ),
});
