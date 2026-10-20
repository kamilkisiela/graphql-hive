import { AlertTriangleIcon } from 'lucide-react';
import { createPreview, type NavPath } from 'react-foundry';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Callout } from '@/components/ui/callout';
import { Heading } from '@/components/ui/heading';
import { InlineCode } from '@/components/ui/inline-code';
import Stat from '@/components/ui/stat';
import { Text } from '@/components/ui/text';
import { CallSite, InventoryList } from './shared';
import * as styles from './presentational.preview.css';

export const nav: NavPath = 'Inventory/Presentational';

/**
 * The seven presentational primitives still to migrate: banners, typography, loading states, Stat
 * and InlineCode. The pills (Badge, BadgeRounded, Tag) moved to base in round 5.
 *
 * These have no behaviour, so the migration is entirely about which variants survive. The export
 * audit found a lot of declared-but-unreachable ones, and several call sites reaching past the
 * variants they were given. Read the Inventory screen first.
 *
 * Counts here are `<Component` render sites, not importing files, and exclude look-alikes: an
 * earlier pass counted `<AlertDialog` as `<Alert` (45 rather than 5) and a page-local `Stat` as
 * `v2/stat` (13 rather than 7).
 */

const ENTRIES = [
  {
    source: 'target-explorer.tsx:212, target-insights-operation.tsx:120 and 5 more',
    origin: 'ui',
    what: 'Alert — banner with title and description, 2 variants',
    coveredBy: 'Banners',
  },
  {
    source: '13 render sites across 8 files',
    origin: 'ui',
    what: 'Callout — same banner role as Alert, brighter palette, own icon set',
    coveredBy: 'Banners',
  },
  {
    source: '43 render sites across 17 files',
    origin: 'ui',
    what: 'Heading — 3 sizes, only 2 reachable; every one renders as an h3',
    coveredBy: 'Typography',
  },
  {
    source: 'pages/auth-sign-in.tsx:316',
    origin: 'ui',
    what: 'Text — 5 variant axes, 1 call site, and its arrangement prop does nothing',
    coveredBy: 'Typography',
  },
  {
    source: 'PlanSummary.tsx ×4, organization-subscription.tsx, -manage.tsx, admin-stats.tsx',
    origin: 'v2',
    what: 'Stat — a dl/dt/dd compound. A page-local Stat of the same name shadows it elsewhere',
    coveredBy: 'Stat',
  },
  {
    source: 'components/target/settings/cdn-access-tokens.tsx:136',
    origin: 'v2',
    what: 'InlineCode — one call site, copy-to-clipboard code chip',
    coveredBy: 'InlineCode',
  },
] as const;

export const Inventory = createPreview({
  label: 'Inventory',
  render: () => (
    <InventoryList
      component="7 presentational primitives"
      summary={
        <>
          <strong>Two pairs do the same job twice.</strong> Alert and Callout are both banners.
          Heading and Text are both typography, and Text has one call site. Each pair disagrees on
          scale, palette and API. Badge, BadgeRounded and Tag were here too until round 5 moved them
          onto base Badge, StatusDot and Callout; see Primitives/Badge.
          <br />
          <br />
          <strong>Unreachable variants, delete rather than port:</strong> Heading <code>2xl</code>;
          Callout <code>default</code> and its <code>emoji</code> prop. Zero call sites each.
          Callout <code>default</code> is never passed explicitly but is reached by omission.
          <br />
          <br />
          <strong>Two live bugs.</strong> <code>Text</code> declares an <code>arrangement</code>{' '}
          variant that the component never passes to <code>textVariants()</code>, so its one call
          site asks for <code>block</code> and gets an inline span. <code>Heading</code> renders{' '}
          <code>h1</code> only for <code>2xl</code>, which no call site uses — so all 43 headings in
          the app are <code>h3</code>, whatever their visual size.
        </>
      }
      entries={ENTRIES}
    />
  ),
});

// ---------------------------------------------------------------------------
// Alert and Callout: the same banner, twice.
// ---------------------------------------------------------------------------

export const Banners = createPreview({
  label: 'Banners',
  render: () => (
    <div className={styles.div}>
      <CallSite
        source="pages/target-explorer.tsx:212 and 3 more"
        origin="ui"
        note="Alert: a muted card fill, rounded-lg, with absolute icon positioning driven by [&>svg] selectors. Four of the seven call sites are this same Outdated Schema warning, copy-pasted across the explorer pages."
      >
        <Alert className={styles.alert}>
          <AlertTriangleIcon className={styles.alertTriangleIcon} />
          <AlertTitle>Outdated Schema</AlertTitle>
          <AlertDescription className={styles.alertDescription}>
            The latest schema version is <span className={styles.span}>not valid</span> , thus the
            explorer might not be accurate as it is showing the{' '}
            <span className={styles.span2}>latest valid</span> schema version. We recommend you to
            publish a new schema version that is composable before using this explorer for decision
            making.
          </AlertDescription>
        </Alert>
      </CallSite>

      <CallSite
        source="pages/target-insights-coordinate.tsx:257"
        origin="ui"
        note="The only Alert that is neither default nor destructive: it hand-rolls an info look with border-info-line-subtle bg-info-tint-subtle text-info. The variant it wants does not exist, so the call site invented it."
      >
        <Alert className={styles.alert2}>
          <AlertTriangleIcon className={styles.alertTriangleIcon2} />
          <AlertTitle>Coordinate resolutions were recently added.</AlertTitle>
          <AlertDescription>
            Your gateway was recently upgraded to add usage tracking for actual coordinate
            resolutions and errors. Please disregard the missing historic resolution data, as this
            data cannot be backfilled.
          </AlertDescription>
        </Alert>
      </CallSite>

      <CallSite
        source="components/ui/callout.tsx"
        origin="ui"
        note="Callout does the same job in a much louder register: saturated 200-level fills with 900-level text, mt-6 baked in, and its own Radix icon per type. Set one beside the Alert above - they are not the same system. The default type (orange, lightning bolt) has zero call sites."
      >
        <div className={styles.div2}>
          <Callout type="warning" className={styles.callout}>
            <b>Your organization has reached it's contract limit.</b>
            <br />
            The data under your organization is still being processed and no data will be lost.
            <br />
            Please contact our support team to increase your contract limit.
          </Callout>
          <Callout type="error" className={styles.callout2}>
            <b>Oops, something went wrong.</b>
            <br />
            Schema composition failed for subgraph &quot;reviews&quot;.
          </Callout>
          <Callout className={styles.callout3} type="info">
            If you want to consume the GraphQL schema for a tool like GraphQL Code Generator, we
            instead recommend using the high-availability CDN instead.
          </Callout>
          <Callout>default type, unused by any call site</Callout>
        </div>
      </CallSite>
    </div>
  ),
});

// ---------------------------------------------------------------------------
// Heading and Text.
// ---------------------------------------------------------------------------

export const Typography = createPreview({
  label: 'Typography',
  render: () => (
    <div className={styles.div3}>
      <CallSite
        source="43 render sites across 17 files"
        origin="ui"
        note="Three sizes declared. xl is the default and carries most of the 43; lg is passed 6 times, all in the SSO settings; 2xl has zero call sites. Since the element is h1 only for 2xl, every heading that ships is an h3 - including the ones that visually head a page."
      >
        <div className={styles.div4}>
          <Heading size="lg">lg — Overview (SSO settings)</Heading>
          <Heading>xl — the default, 37 of 43 uses</Heading>
          <Heading size="2xl">2xl — the only h1, and unreachable</Heading>
        </div>
      </CallSite>

      <CallSite
        source="10 of 19 Heading classNames"
        origin="ui"
        note="text-center is the single most common override, 10 times - almost always a modal or sheet title. The rest are margins: mb-4, mb-2, mb-1, my-2, mb-3. A component that needs a margin at half its call sites is missing a prop."
      >
        <div className={styles.div5}>
          <Heading className={styles.heading}>Create an alert</Heading>
          <Heading size="lg" className={styles.heading2}>
            size=lg with text-sm — two opposing instructions on one element
          </Heading>
        </div>
      </CallSite>

      <CallSite
        source="pages/auth-sign-in.tsx:316"
        origin="ui"
        note="Text's only call site, and it does not work. It asks for arrangement='block', but the component destructures color/size/weight/align and calls textVariants({ color, size, weight, align }) - arrangement is never passed through. It also never forwards `as`, so this renders as an inline span. The centring below comes from align, not from block."
      >
        <div className={styles.div6}>
          <Text arrangement="block" align="center" size="small" color="secondary">
            Don&apos;t have an account?{' '}
            <a href="#" className={styles.a}>
              Sign up
            </a>
          </Text>
        </div>
      </CallSite>

      <CallSite
        source="components/ui/text.tsx"
        origin="ui"
        note="The rest of the variant matrix, none of which any call site uses: 5 sizes, 4 weights, 2 colours, 4 alignments. Built for a design system that never arrived."
      >
        <div className={styles.div7}>
          {(['x-small', 'small', 'medium', 'large', 'x-large'] as const).map(size => (
            <Text key={size} size={size}>
              {size}
            </Text>
          ))}
        </div>
      </CallSite>
    </div>
  ),
});

// ---------------------------------------------------------------------------
// v2/stat and v2/inline-code.
// ---------------------------------------------------------------------------

export const StatPreview = createPreview({
  label: 'Stat',
  render: () => (
    <div className={styles.div8}>
      <CallSite
        source="components/organization/billing/PlanSummary.tsx:100, :114, :121, :127"
        origin="v2"
        note="A dl/dt/dd compound: Label, Number, HelpText, in whatever order the call site wants. PlanSummary puts HelpText both above and below the Number to build 'up to 10M per month', which is the only reason the parts are separate."
      >
        <div className={styles.div9}>
          <Stat>
            <Stat.Label>Plan Type</Stat.Label>
            <Stat.Number>ENTERPRISE</Stat.Number>
            <Stat.HelpText>
              Enterprise plan is for organizations that needs to ship and ingest large amount of
              data, and needs ongoing support around GraphQL APIs.
            </Stat.HelpText>
          </Stat>
          <Stat>
            <Stat.Label>Operations Limit</Stat.Label>
            <Stat.HelpText>up to</Stat.HelpText>
            <Stat.Number>10M</Stat.Number>
            <Stat.HelpText>per month</Stat.HelpText>
          </Stat>
        </div>
      </CallSite>

      <CallSite
        source="pages/target-history-schema-version.tsx:1622"
        origin="v2"
        note="A name collision worth knowing about before migrating. That page defines its OWN Stat - `<Stat label value additionalValue />` - which shadows v2/stat entirely and accounts for 6 of the 13 <Stat> matches a naive grep returns. v2/stat has 7 real render sites, not 13."
      >
        <div className={styles.div10}>
          Not rendered: it is a page-local component, not a shared primitive. Migrating v2/stat does
          not touch it.
        </div>
      </CallSite>
    </div>
  ),
});

export const InlineCodePreview = createPreview({
  label: 'InlineCode',
  render: () => (
    <CallSite
      source="components/target/settings/cdn-access-tokens.tsx:136"
      origin="v2"
      note="One call site. A filled code chip with a copy button that posts a notification. Overlaps ui/code, which has one internal caller of its own - two components for one job, each used once."
    >
      <div className={styles.div11}>
        <InlineCode content="hv1/8f3a11c2e4d6b90a7c5e3f1d2b4a6c8e" />
      </div>
    </CallSite>
  ),
});
