import { AlertTriangleIcon } from 'lucide-react';
import { createPreview, type NavPath } from 'react-foundry';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Callout } from '@/components/ui/callout';
import { Heading } from '@/components/ui/heading';
import { InlineCode } from '@/components/ui/inline-code';
import Stat from '@/components/ui/stat';
import { Text } from '@/components/ui/text';
import { CallSite, InventoryList } from './shared';

export const nav: NavPath = 'Inventory/Presentational';

/**
 * The six presentational `ui/` components still to migrate: banners, typography, Stat and
 * InlineCode. The pills (Badge, BadgeRounded, Tag) moved to base in round 5.
 *
 * These have no behaviour, so the migration is entirely about which variants survive. The export
 * audit found a lot of declared-but-unreachable ones, and several call sites reaching past the
 * variants they were given. Read the Inventory screen first.
 *
 * Counts here are `<Component` render sites, not importing files, and exclude look-alikes: an
 * earlier pass counted `<AlertDialog` as `<Alert` and a page-local `Stat` as `ui/stat`. Recount
 * before trusting them; the numbers below were taken in October 2026.
 */

const ENTRIES = [
  {
    source: 'target-explorer.tsx:189, target-insights-operation.tsx:123 and 5 more',
    origin: 'ui',
    what: 'Alert — banner with title and description, 2 variants; 7 render sites across 6 files',
    coveredBy: 'Banners',
  },
  {
    source: '20 render sites across 13 files',
    origin: 'ui',
    what: 'Callout — same banner role as Alert, brighter palette, own icon set',
    coveredBy: 'Banners',
  },
  {
    source: '24 render sites across 14 files',
    origin: 'ui',
    what: 'Heading — 3 sizes, only 2 reachable; every one renders as an h3',
    coveredBy: 'Typography',
  },
  {
    source: 'pages/auth-sign-in.tsx:259, billing/retention-note.tsx:24',
    origin: 'ui',
    what: 'Text — 5 variant axes, 2 call sites, and its arrangement prop does nothing',
    coveredBy: 'Typography',
  },
  {
    source: 'PlanSummary.tsx ×2, organization-subscription.tsx, -manage.tsx, admin-stats.tsx',
    origin: 'ui',
    what: 'Stat — a dl/dt/dd compound. A page-local Stat of the same name shadows it elsewhere',
    coveredBy: 'Stat',
  },
  {
    source: 'components/target/settings/cdn-access-tokens.tsx:100',
    origin: 'ui',
    what: 'InlineCode — one call site, copy-to-clipboard code chip; base CopyChip is its successor',
    coveredBy: 'InlineCode',
  },
] as const;

export const Inventory = createPreview({
  label: 'Inventory',
  render: () => (
    <InventoryList
      component="6 presentational components"
      summary={
        <>
          <strong>Two pairs do the same job twice.</strong> Alert and Callout are both banners.
          Heading and Text are both typography, and Text has two call sites. Each pair disagrees on
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
          variant that the component never passes to <code>textVariants()</code>, so the sign-in
          call site asks for <code>block</code> and gets an inline span. <code>Heading</code>{' '}
          renders <code>h1</code> only for <code>2xl</code>, which no call site uses — so all 24
          headings in the app are <code>h3</code>, whatever their visual size.
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
    <div className="flex flex-col gap-8">
      <CallSite
        source="pages/target-explorer.tsx:189 and 2 more"
        origin="ui"
        note="Alert: a muted card fill, rounded-lg, with absolute icon positioning driven by [&>svg] selectors. Three of the seven call sites are this same Outdated Schema warning, copy-pasted across the explorer pages."
      >
        <Alert className="mb-3">
          <AlertTriangleIcon className="size-4" />
          <AlertTitle>Outdated Schema</AlertTitle>
          <AlertDescription className="max-w-[600px]">
            The latest schema version is <span className="font-bold">not valid</span> , thus the
            explorer might not be accurate as it is showing the{' '}
            <span className="font-bold">latest valid</span> schema version. We recommend you to
            publish a new schema version that is composable before using this explorer for decision
            making.
          </AlertDescription>
        </Alert>
      </CallSite>

      <CallSite
        source="pages/target-insights-coordinate.tsx:253"
        origin="ui"
        note="The only Alert that is neither default nor destructive: it hand-rolls an info look with border-info-line-subtle bg-info-tint-subtle text-info. The variant it wants does not exist, so the call site invented it."
      >
        <Alert className="border-info-line-subtle bg-info-tint-subtle text-info">
          <AlertTriangleIcon className="size-4" />
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
        <div className="flex flex-col gap-3">
          <Callout type="warning" className="mb-2 w-full">
            <b>Your organization has reached it's contract limit.</b>
            <br />
            The data under your organization is still being processed and no data will be lost.
            <br />
            Please contact our support team to increase your contract limit.
          </Callout>
          <Callout type="error" className="mx-auto w-2/3">
            <b>Oops, something went wrong.</b>
            <br />
            Schema composition failed for subgraph &quot;reviews&quot;.
          </Callout>
          <Callout className="mt-2" type="info">
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
    <div className="flex flex-col gap-8">
      <CallSite
        source="24 render sites across 14 files"
        origin="ui"
        note="Three sizes declared. xl is the default and carries 18 of the 24; lg is passed 6 times, in the SSO settings and the role-mapping picker sheet; 2xl has zero call sites. Since the element is h1 only for 2xl, every heading that ships is an h3 - including the ones that visually head a page."
      >
        <div className="flex flex-col gap-3">
          <Heading size="lg">lg — Overview (SSO settings)</Heading>
          <Heading>xl — the default, 18 of 24 uses</Heading>
          <Heading size="2xl">2xl — the only h1, and unreachable</Heading>
        </div>
      </CallSite>

      <CallSite
        source="6 of 24 Headings pass a className"
        origin="ui"
        note="One text-center (the empty-list title); the rest are margins: mb-4 twice, mb-3, and mb-1 text-sm twice in the role-mapping sheet. A component that needs a margin at a quarter of its call sites is missing a prop."
      >
        <div className="flex w-[28rem] flex-col gap-3">
          <Heading className="text-center">Create an alert</Heading>
          <Heading size="lg" className="mb-1 text-sm">
            size=lg with text-sm — two opposing instructions on one element
          </Heading>
        </div>
      </CallSite>

      <CallSite
        source="pages/auth-sign-in.tsx:259"
        origin="ui"
        note="The sign-in call site, and it does not work. It asks for arrangement='block', but the component destructures color/size/weight/align and calls textVariants({ color, size, weight, align }) - arrangement is never passed through. Without `as` it renders as an inline span. The centring below comes from align, not from block. The other call site, retention-note.tsx:24, passes as='p' and so gets the block it wants."
      >
        <div className="w-[28rem] rounded-md border border-dashed border-line p-3">
          <Text arrangement="block" align="center" size="small" color="secondary">
            Don&apos;t have an account?{' '}
            <a href="#" className="text-accent underline">
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
        <div className="flex flex-col gap-1">
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
// ui/stat and ui/inline-code.
// ---------------------------------------------------------------------------

export const StatPreview = createPreview({
  label: 'Stat',
  render: () => (
    <div className="flex flex-col gap-8">
      <CallSite
        source="components/organization/billing/PlanSummary.tsx:142, :164"
        origin="ui"
        note="A dl/dt/dd compound: Label, Number, HelpText, in whatever order the call site wants. PlanSummary puts HelpText both above and below the Number to build 'up to 10M per month', which is the only reason the parts are separate."
      >
        <div className="flex flex-col gap-6">
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
        source="pages/target-history-schema-version.tsx:1631"
        origin="ui"
        note="A name collision worth knowing about before migrating. That page defines its OWN Stat - `<Stat label value additionalValue />` - which shadows ui/stat entirely and accounts for 6 of the 11 <Stat> matches a naive grep returns. ui/stat has 5 real render sites, not 11."
      >
        <div className="rounded-md border border-dashed border-line p-3 text-xs text-fg-default">
          Not rendered: it is a page-local component, not a shared primitive. Migrating ui/stat does
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
      source="components/target/settings/cdn-access-tokens.tsx:100"
      origin="ui"
      note="One call site. A filled code chip with a copy button that posts a notification. Overlaps ui/code, which has one internal caller of its own (empty-list) - two legacy components for one job, each used once. Base CopyChip (Primitives/CopyChip) is the replacement."
    >
      <div className="w-[32rem]">
        <InlineCode content="hv1/8f3a11c2e4d6b90a7c5e3f1d2b4a6c8e" />
      </div>
    </CallSite>
  ),
});
