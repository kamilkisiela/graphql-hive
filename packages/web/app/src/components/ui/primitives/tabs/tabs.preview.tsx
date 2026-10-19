import { useState, type ReactNode } from 'react';
import { Box, Check, FileCode2, Layers, List } from 'lucide-react';
import { controlsFor, createPreview, type NavPath } from 'react-foundry';
import { Badge } from '../badge/badge';
import { Tabs, type TabItem } from './tabs';
import * as styles from './tabs.preview.css';

export const nav: NavPath = 'Primitives/Tabs';

/**
 * Items in, a tab strip out, with a sliding indicator and panels when the items carry content.
 * For navigation use `Navigation`; for a view switch over a page, `TabbedView`, which is where the
 * `header` look ships (see Components/TabbedView). Each look below is drawn with the call sites
 * it ships at, real copy included.
 */

// ---------------------------------------------------------------------------
// The call sites, as items
// ---------------------------------------------------------------------------

function Copy({ children }: { children: ReactNode }) {
  return <p className={styles.copyP}>{children}</p>;
}

/** project/settings/composition.tsx: the active mode carries a check. */
function compositionItems(active: string): TabItem[] {
  const mark = (value: string, label: string) => (
    <>
      {label}
      {active === value ? <Check className={styles.markCheck} /> : null}
    </>
  );
  return [
    {
      value: 'native',
      label: mark('native', 'Native Federation v2'),
      content: <Copy>Native composition settings.</Copy>,
    },
    {
      value: 'external',
      label: mark('external', 'External'),
      content: <Copy>External composition settings.</Copy>,
    },
    {
      value: 'legacy',
      label: mark('legacy', 'Legacy Federation v1'),
      content: <Copy>Legacy composition settings.</Copy>,
    },
  ];
}

/** layouts/target.tsx: the CDN access dialog. */
const GATEWAYS: TabItem[] = [
  {
    value: 'hive-gateway',
    label: 'Hive Gateway',
    content: (
      <Copy>
        Start up a Hive Gateway instance polling the supergraph from the Hive CDN using the
        following command.
      </Copy>
    ),
  },
  {
    value: 'hive-router',
    label: 'Hive Router',
    content: (
      <Copy>
        Start up a Hive Router instance polling the supergraph from the Hive CDN using the following
        command.
      </Copy>
    ),
  },
  {
    value: 'apollo-router',
    label: 'Apollo Router',
    content: <Copy>Apollo Router instructions.</Copy>,
  },
  {
    value: 'grafbase-gateway',
    label: 'Grafbase Gateway',
    content: <Copy>Grafbase Gateway instructions.</Copy>,
  },
  { value: 'cdn', label: 'Custom / HTTP', content: <Copy>Fetch the artifacts over HTTP.</Copy> },
];

/** single-sign-on/connect-single-sign-on-provider-sheet.tsx, inside the sheet. */
const SSO: TabItem[] = [
  {
    value: 'discovery',
    label: 'Discovery Document',
    content: <Copy>Metadata fetcher, then the form.</Copy>,
  },
  { value: 'manual', label: 'Manual', content: <Copy>The form.</Copy> },
];

/** members/resource-selector.tsx, inside the role mapping sheet. */
const ACCESS: TabItem[] = [
  {
    value: 'full',
    label: 'Full Access',
    content: (
      <Copy>
        The permissions are granted on all projects, targets and services within the organization.
      </Copy>
    ),
  },
  {
    value: 'granular',
    label: 'Granular Access',
    content: <Copy>The permissions are granted on the specified resources.</Copy>,
  },
];

/** pages/target-history-schema-version.tsx: the version views, rendered by the page. */
const VERSION_VIEWS: TabItem[] = [
  { value: 'details', label: 'Summary', icon: List },
  { value: 'full-schema', label: 'Schema', icon: FileCode2 },
  { value: 'supergraph', label: 'Supergraph', icon: Layers },
  { value: 'service-schema', label: 'Subgraphs', icon: Box },
];

/** pages/target-trace.tsx: the span sheet's strip, hand-rolled today, with a count per tab. */
const counted = (label: string, count: number) => (
  <>
    {label}
    <Badge content={String(count)} variants={{ variant: 'secondary', size: 'sm' }} />
  </>
);
const SPAN_VIEWS: TabItem[] = [
  { value: 'span-attributes', label: counted('Span Attributes', 8) },
  { value: 'resource-attributes', label: counted('Resource Attributes', 3) },
  { value: 'events', label: counted('Events', 0) },
  { value: 'operation', label: 'GraphQL Operation' },
];

// ---------------------------------------------------------------------------
// The looks, each on its own call sites
// ---------------------------------------------------------------------------

/** `underline`, proposed default: every strip that switches a panel or a page-rendered view. */
export const Underline = createPreview(() => {
  const [mode, setMode] = useState('native');
  const [view, setView] = useState('details');
  return (
    <div className={styles.div}>
      <Labelled label="project/settings/composition.tsx">
        <Tabs items={compositionItems(mode)} value={mode} onValueChange={setMode} />
      </Labelled>
      <Labelled label="layouts/target.tsx, the CDN access dialog">
        <Tabs items={GATEWAYS} defaultValue="hive-gateway" />
      </Labelled>
      <Labelled label="connect-single-sign-on-provider-sheet.tsx">
        <Tabs items={SSO} defaultValue="discovery" />
      </Labelled>
      <Labelled label="members/resource-selector.tsx">
        <Tabs items={ACCESS} defaultValue="granular" />
      </Labelled>
      <Labelled label="The schema version views, with icons; the page renders the view">
        <div className={styles.div2}>
          <Tabs items={VERSION_VIEWS} value={view} onValueChange={setView} />
          <Copy>The {view} view, rendered by the page.</Copy>
        </div>
      </Labelled>
      <Labelled label="pages/target-trace.tsx, the span sheet strip, sm">
        <Tabs items={SPAN_VIEWS} defaultValue="span-attributes" size="sm" />
      </Labelled>
    </div>
  );
});

const SERVICES = [
  'users',
  'products',
  'reviews',
  'inventory',
  'orders',
  'billing',
  'search',
  'notifications',
  'analytics',
  'support',
  'admin',
  'legacy-web',
];

/**
 * A strip scrolls sideways once its tabs outgrow it, scrollbar hidden: swipe, drag, or walk the
 * tabs with the arrow keys and the focused one scrolls into view. The frame below is a flex
 * column, the layout that used to stretch to fit every tab and push the page sideways, since a
 * flex item is at least as wide as its content unless told otherwise. The strip now keeps its
 * tabs out of that measurement, so the column stays the width it was given.
 */
export const ManyTabs = createPreview(() => {
  const [service, setService] = useState(SERVICES[0]);
  return (
    <div className={styles.div3}>
      <Labelled label="proposals/editor.tsx, the service strip, in a two-column layout at 40rem">
        <div className={styles.div4}>
          <div className={styles.div5}>Services</div>
          <div className={styles.div6}>
            <Tabs
              items={SERVICES.map(name => ({ value: name, label: name }))}
              value={service}
              onValueChange={setService}
            />
            <Copy>The {service} subgraph's editor.</Copy>
          </div>
        </div>
      </Labelled>
    </div>
  );
});

/** A column of tabs with the panels beside them: the new-proposal page's sections. */
export const Vertical = createPreview(() => (
  <Labelled label="pages/target-proposals-new.tsx">
    <Tabs
      orientation="vertical"
      items={[
        {
          value: 'overview',
          label: 'Overview',
          content: <Copy>Title and description of the proposal.</Copy>,
        },
        { value: 'editor', label: 'Editor', content: <Copy>One editor per changed service.</Copy> },
        {
          value: 'changes',
          label: 'Changes',
          content: <Copy>The diff against the current schema.</Copy>,
        },
      ]}
      defaultValue="editor"
    />
  </Labelled>
));

export const Playground = createPreview({
  controls: controlsFor(Tabs, {
    variant: { type: 'radio', options: ['underline', 'header'], default: 'underline' },
    size: { type: 'radio', options: ['default', 'sm'], default: 'default' },
    orientation: { type: 'radio', options: ['horizontal', 'vertical'], default: 'horizontal' },
  }),
  render: v => (
    <Tabs
      items={GATEWAYS}
      defaultValue="hive-gateway"
      variant={v.variant}
      size={v.size}
      orientation={v.orientation}
    />
  ),
});

function Labelled(props: { label: string; children: ReactNode }) {
  return (
    <div className={styles.labelledDiv}>
      <span className={styles.labelledSpan}>{props.label}</span>
      {props.children}
    </div>
  );
}
