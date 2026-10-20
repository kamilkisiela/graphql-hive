import { useState, type ReactNode } from 'react';
import { FolderIcon, FolderOpenIcon, MoreHorizontal, Plus } from 'lucide-react';
import { controlsFor, createPreview, type NavPath } from 'react-foundry';
import { Badge } from '../badge/badge';
import { Button } from '../button/button';
import { Card } from '../card/card';
import { Menu } from '../floating/menu/menu';
import { Accordion } from './accordion';

export const nav: NavPath = 'Primitives/Accordion';

/**
 * Items in, an accordion out, on Base UI. One trigger look: medium text, the chevron at the end,
 * no underline on hover.
 */

function Copy({ children }: { children: ReactNode }) {
  return <p className="text-sm text-fg-default">{children}</p>;
}

function Labelled(props: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <span className="text-xs text-fg-secondary">{props.label}</span>
      {props.children}
    </div>
  );
}

const CHANGES = [
  {
    value: 'breaking',
    label: 'Breaking changes',
    body: 'Field User.email was removed from type User.',
  },
  {
    value: 'dangerous',
    label: 'Dangerous changes',
    body: 'Enum value PENDING was added to Status.',
  },
  { value: 'safe', label: 'Safe changes', body: 'Description on type Query has changed.' },
];

export const Default = createPreview(() => (
  <div className="w-96">
    <Accordion
      items={CHANGES.map(change => ({
        value: change.value,
        label: change.label,
        content: <Copy>{change.body}</Copy>,
      }))}
    />
  </div>
));

/** `defaultValue` opens items on mount; `multiple` lets more than one stay open. */
export const DefaultOpen = createPreview(() => (
  <div className="flex w-96 flex-col gap-10">
    <Labelled label="single, the default: opening one closes the other">
      <Accordion
        defaultValue={['breaking']}
        items={CHANGES.map(change => ({
          value: change.value,
          label: change.label,
          content: <Copy>{change.body}</Copy>,
        }))}
      />
    </Labelled>
    <Labelled label="multiple">
      <Accordion
        multiple
        defaultValue={['breaking', 'safe']}
        items={CHANGES.map(change => ({
          value: change.value,
          label: change.label,
          content: <Copy>{change.body}</Copy>,
        }))}
      />
    </Labelled>
  </div>
));

const PERMISSION_GROUPS = [
  { value: 'Organization', selected: 2, total: 4 },
  { value: 'Project', selected: 0, total: 3 },
  { value: 'Schema Registry', selected: 3, total: 3 },
];

/**
 * members/permission-selector.tsx: the open set held by the form, a count at the trigger's far
 * end. `trailing` sits before the chevron.
 */
export const Controlled = createPreview(() => {
  const [open, setOpen] = useState<string[]>([]);
  return (
    <div className="w-[36rem]">
      <Accordion
        multiple
        value={open}
        onValueChange={setOpen}
        items={PERMISSION_GROUPS.map(group => ({
          value: group.value,
          label: group.value,
          trailing: group.selected ? (
            <span className="text-xs text-fg-secondary">{group.selected} selected</span>
          ) : undefined,
          content: <Copy>{group.total} permissions in this group.</Copy>,
        }))}
      />
      <p className="mt-3 text-xs text-fg-secondary">Open: {open.join(', ') || 'none'}</p>
    </div>
  );
});

const SERVICES = [
  { id: 's1', service: 'users', url: 'https://users.storefront.local/graphql' },
  { id: 's2', service: 'products', url: 'https://products.storefront.local/graphql' },
];

/** pages/target.tsx: `boxed`, each service a card with a two-line header and its SDL inside. */
export const Boxed = createPreview(() => (
  <div className="w-[40rem]">
    <Accordion
      variant="boxed"
      items={SERVICES.map(schema => ({
        value: schema.id,
        label: (
          <div>
            <div className="text-base text-fg">{schema.service}</div>
            <div className="text-xs font-normal text-fg-secondary">{schema.url}</div>
          </div>
        ),
        content: (
          <pre className="font-mono text-xs leading-relaxed text-fg-default">
            {'type Query {\n  me: User\n}'}
          </pre>
        ),
      }))}
    />
  </div>
));

/**
 * alerts/alert-form.tsx, Advanced settings: `plain`, so no hairline under a lone disclosure;
 * small, the chevron at the start, and the accent tone to call it out.
 */
export const SmallAccentDisclosure = createPreview(() => (
  <div className="w-[28rem]">
    <Card variants={{ onSurface: 'raised' }}>
      <Accordion
        variant="plain"
        size="sm"
        chevron="start"
        tone="accent"
        items={[
          {
            value: 'advanced',
            label: 'Advanced settings',
            content: <Copy>On filter, hold minutes.</Copy>,
          },
        ]}
      />
    </Card>
  </div>
));

const COLLECTIONS = [
  { id: 'c1', name: 'Onboarding', operations: ['GetViewer', 'ListProjects'] },
  { id: 'c2', name: 'Regression', operations: ['PublishSchema'] },
];

/**
 * laboratory collections: no chevron, folder icons in the label that swap on open, and a menu
 * beside the trigger through `action`, which stays outside the trigger button.
 */
export const WithAction = createPreview(() => {
  const [open, setOpen] = useState<string[]>(['c1']);
  return (
    <div className="w-72">
      <Accordion
        multiple
        chevron="none"
        value={open}
        onValueChange={setOpen}
        items={COLLECTIONS.map(collection => ({
          value: collection.id,
          label: (
            <span className="inline-flex items-center gap-x-3">
              {open.includes(collection.id) ? (
                <FolderOpenIcon className="size-4" />
              ) : (
                <FolderIcon className="size-4" />
              )}
              {collection.name}
            </span>
          ),
          action: (
            <Menu
              align="end"
              // The laboratory styles this trigger with GraphiQL's toolbar class, which foundry does not load.
              trigger={
                <Button layout="iconOnly" icon={MoreHorizontal} variant="ghost" aria-label="More" />
              }
              sections={[
                [{ label: 'Add operation', trailingIcon: Plus, onClick: () => {} }],
                [
                  { label: 'Edit', onClick: () => {} },
                  { label: 'Delete', variant: 'destructiveAction', onClick: () => {} },
                ],
              ]}
            />
          ),
          content: (
            <ul className="space-y-1 pl-2 text-sm text-fg-default">
              {collection.operations.map(name => (
                <li key={name}>{name}</li>
              ))}
            </ul>
          ),
          attrs: { 'data-cy': 'collection-item' },
        }))}
      />
    </div>
  );
});

/** A disabled item keeps its place and its label, and cannot open. */
export const Disabled = createPreview(() => (
  <div className="w-96">
    <Accordion
      items={[
        { value: 'a', label: 'Composition errors', content: <Copy>None.</Copy> },
        {
          value: 'b',
          label: (
            <span className="inline-flex items-center gap-2">
              Breaking changes
              <Badge content="approved" variants={{ variant: 'secondary', size: 'sm' }} />
            </span>
          ),
          content: <Copy>Two, both approved.</Copy>,
          disabled: true,
        },
      ]}
    />
  </div>
));

// The call sites that will have rows with nothing to open: errors-and-changes.tsx ChangeItem and
// proposals/change-detail.tsx. Each renders one Accordion per change, stacked. The labels here are
// plain text; Components → ChangesBlock → UsageLabels shows the real ChangeItem with its chips.
type Row = { value: string; label: string; badge?: ReactNode; body?: string };

function OnePerChange(props: { variant: 'boxed' | 'list'; rows: Row[]; gap: string }) {
  return (
    <div className={props.gap}>
      {props.rows.map(row => (
        <Accordion
          key={row.value}
          variant={props.variant}
          items={[
            {
              value: row.value,
              label: row.label,
              trailing: row.badge,
              content: row.body ? <Copy>{row.body}</Copy> : null,
            },
          ]}
        />
      ))}
    </div>
  );
}

const BREAKING: Row[] = [
  {
    value: 'field-type',
    label: "Field 'ConversionRate.fromCurrency' changed type from 'Currency!' to 'ForexCurrency!'",
    badge: (
      <Badge
        content="11 clients"
        tooltip="10 operations by 11 clients affected"
        variants={{ variant: 'critical' }}
      />
    ),
    // In the app this panel holds the usage tables, which this primitive story leaves out.
    body: 'Affected operations and clients.',
  },
  {
    value: 'type-removed',
    label: "Type 'Currency' was removed",
    badge: (
      <Badge
        content="Usage not tracked"
        tooltip="Usage isn't tracked for this kind of change, so it can't be called safe"
        variants={{ variant: 'secondary' }}
      />
    ),
  },
  {
    value: 'union-member',
    label: "Member 'Movie' was removed from Union type 'SearchResult'",
    badge: (
      <Badge
        content="Usage not tracked"
        tooltip="Usage isn't tracked for this kind of change, so it can't be called safe"
        variants={{ variant: 'secondary' }}
      />
    ),
    body: 'Removing a union member from a union can cause existing queries that use this union member in a fragment spread to error.',
  },
];

const SAFE: Row[] = [
  {
    value: 'description',
    label:
      "Description 'Stress type 12, used to test large schemas.' on type 'StressType_12' has changed to 'Stress type 12, used to test large schemas (revised).'",
  },
  { value: 'field-added', label: "Field 'value8' was added to object type 'StressType_12'" },
  {
    value: 'union-member-added',
    label: "Member 'Podcast' was added to Union type 'SearchResult'",
    body: 'Adding a possible type to Unions may break existing clients that were not programming defensively against a new possible type.',
  },
];

/**
 * An item without `content` is a static row: the same header, no chevron, nothing to open. Its
 * label and trailing line up with the rows around it that do open.
 */
export const StaticRows = createPreview(() => (
  <div className="flex w-[56rem] flex-col gap-10">
    <Labelled label="Breaking changes on a check: boxed, one accordion per change (ChangeItem)">
      <OnePerChange variant="boxed" rows={BREAKING} gap="flex flex-col gap-4" />
    </Labelled>
    <Labelled label="Safe changes, and the history page: list, one accordion per change (ChangeItem)">
      <OnePerChange variant="list" rows={SAFE} gap="flex flex-col gap-2" />
    </Labelled>
    <Labelled label="Proposals: list, one item, no error to show (ProposalChangeDetail)">
      <OnePerChange
        variant="list"
        rows={[{ value: 'proposal', label: "Field 'Query.products' was removed" }]}
        gap=""
      />
    </Labelled>
  </div>
));

export const Playground = createPreview({
  controls: controlsFor(Accordion, {
    variant: { type: 'radio', options: ['list', 'boxed', 'plain'], default: 'list' },
    size: { type: 'radio', options: ['default', 'sm'], default: 'default' },
    chevron: { type: 'radio', options: ['end', 'start', 'none'], default: 'end' },
    tone: { type: 'radio', options: ['default', 'accent'], default: 'default' },
    multiple: { type: 'boolean', default: false },
    keepMounted: { type: 'boolean', default: false },
  }),
  render: v => (
    <div className="w-[32rem]">
      <Accordion
        variant={v.variant}
        size={v.size}
        chevron={v.chevron}
        tone={v.tone}
        multiple={v.multiple}
        keepMounted={v.keepMounted}
        items={CHANGES.map((change, index) => ({
          value: change.value,
          label: change.label,
          trailing: index === 0 ? <span className="text-xs text-fg-secondary">2</span> : undefined,
          content: <Copy>{change.body}</Copy>,
        }))}
      />
    </div>
  ),
});
