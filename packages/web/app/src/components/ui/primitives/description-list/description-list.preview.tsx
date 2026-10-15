import { controlsFor, createPreview, type NavPath } from 'react-foundry';
import { Badge } from '../badge/badge';
import { Button } from '../button/button';
import { DescriptionList } from './description-list';

export const nav: NavPath = 'Primitives/DescriptionList';

export const Default = createPreview(() => (
  <div className="w-[36rem]">
    <DescriptionList
      rows={[
        {
          items: [
            { term: 'Metric', description: 'p99 latency' },
            { term: 'Threshold', description: '500ms' },
          ],
        },
        {
          items: [
            { term: 'Window', description: 'Last 15 minutes' },
            { term: 'Evaluated every', description: '5 minutes' },
          ],
        },
      ]}
    />
  </div>
));

/** Column count is derived per row from `items.length`, so rows can differ. */
export const MixedColumns = createPreview(() => (
  <div className="w-[36rem]">
    <DescriptionList
      rows={[
        { items: [{ term: 'Name', description: 'P99 latency spike' }] },
        {
          items: [
            { term: 'Metric', description: 'p99 latency' },
            { term: 'Threshold', description: '500ms' },
            { term: 'Window', description: '15m' },
          ],
        },
        {
          items: [
            { term: 'Created', description: '3 Aug 2026' },
            { term: 'Created by', description: 'user@the-guild.dev' },
          ],
        },
      ]}
    />
  </div>
));

/** `description` takes a ReactNode, so cells can hold components rather than text. */
export const RichDescriptions = createPreview(() => (
  <div className="w-[36rem]">
    <DescriptionList
      rows={[
        {
          items: [
            { term: 'Target', description: <code className="text-control">production</code> },
            {
              term: 'Status',
              description: <Badge content="Active" variants={{ variant: 'secondary' }} />,
            },
          ],
        },
        {
          items: [
            {
              term: 'Channels',
              description: (
                <div className="flex flex-wrap gap-1.5">
                  <Badge content="Slack" variants={{ variant: 'outline' }} />
                  <Badge content="Webhook" variants={{ variant: 'outline' }} />
                  <Badge content="Email" variants={{ variant: 'outline' }} />
                </div>
              ),
            },
          ],
        },
      ]}
    />
  </div>
));

/**
 * `mono` for identifiers, `copyable` for values the reader pastes somewhere, and `attrs` lands on
 * the value element for a test hook.
 */
export const CopyableValues = createPreview(() => (
  <div className="w-[36rem]">
    <DescriptionList
      rows={[
        {
          items: [
            {
              term: 'Sign-in redirect URI',
              description: 'https://app.graphql-hive.com/auth/callback/oidc',
              mono: true,
              copyable: true,
              attrs: { 'data-oidc-property-sign-in-redirect-uri': '' },
            },
          ],
        },
        {
          items: [
            { term: 'Type', description: 'TXT', mono: true, copyable: true },
            {
              term: 'Name',
              description: '_hive-challenge.example.com',
              mono: true,
              copyable: true,
            },
            {
              term: 'Value',
              description: 'hive-domain-verification=3af771c7',
              mono: true,
              copyable: true,
            },
          ],
        },
      ]}
    />
  </div>
));

/** A term that needs explaining carries it on an info icon. */
export const TermTooltips = createPreview(() => (
  <div className="w-[36rem]">
    <DescriptionList
      rows={[
        {
          items: [
            {
              term: 'User ID Claim',
              tooltip: 'The claim that should be used to uniquely identify an user.',
              description: 'sub',
              mono: true,
            },
            {
              term: 'Additional Scopes',
              tooltip: 'Additional scopes that are requested from the OIDC provider.',
              description: <span className="text-fg-subtle">none</span>,
            },
          ],
        },
      ]}
    />
  </div>
));

/**
 * `termStyle: 'title'` swaps the small caps for 12px sentence-case terms, and `columns: 'auto'`
 * sizes each item to its value with an even gap. Together they make the meta card at the top of
 * the schema check and schema version pages. The wrapper and the Approve button are the check
 * page's (`pages/target-checks-single.tsx:1516`): the list takes the free width, the action stays
 * right.
 */
export const PageCard = createPreview(() => (
  <div className="flex w-[64rem] items-center gap-4 rounded-md border bg-surface-card px-5 py-4">
    <div className="min-w-0 flex-1">
      <DescriptionList
        variants={{ termStyle: 'title', columns: 'auto' }}
        rows={[
          {
            items: [
              { term: 'Status', description: <span className="text-critical">Failed</span> },
              { term: 'Service', description: 'users' },
              {
                term: 'Triggered',
                description: '1h ago by User <user@the-guild.dev>',
              },
              {
                term: 'Commit',
                description: (
                  <span className="block truncate" title="82c6adaa916c765b76fe9a1043ed4b0c9e1a7f22">
                    82c6adaa916c765b76fe9a1043ed4b0c9e1a7f22
                  </span>
                ),
              },
            ],
          },
        ]}
      />
    </div>
    <Button variant="destructive">Approve</Button>
  </div>
));

export const SingleColumn = createPreview(() => (
  <div className="w-80">
    <DescriptionList
      rows={[
        { items: [{ term: 'Organization', description: 'the-guild' }] },
        { items: [{ term: 'Project', description: 'hive-console' }] },
        { items: [{ term: 'Target', description: 'production' }] },
      ]}
    />
  </div>
));

export const Playground = createPreview({
  controls: controlsFor(DescriptionList, {
    variants: {
      termStyle: { type: 'radio', options: ['label', 'title'], default: 'label' },
      columns: { type: 'radio', options: ['fixed', 'auto'], default: 'fixed' },
    },
  }),
  // The rows stay fixed: a list of lists is more than a control can draw. Resize the frame to
  // see `columns: 'auto'` wrap where `fixed` squeezes.
  render: v => (
    <div className="max-w-[48rem]">
      <DescriptionList
        variants={v.variants}
        rows={[
          {
            items: [
              { term: 'Status', description: 'Failed' },
              { term: 'Service', description: 'products' },
              { term: 'Triggered', description: '3 days ago by Ada Lovelace' },
              { term: 'Commit', description: 'bf0e040f', mono: true },
            ],
          },
        ]}
      />
    </div>
  ),
});
