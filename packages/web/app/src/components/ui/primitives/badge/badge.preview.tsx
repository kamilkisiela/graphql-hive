import { ActivityIcon, BoxIcon, CheckIcon, TriangleAlertIcon } from 'lucide-react';
import { controlsFor, createPreview, type NavPath } from 'react-foundry';
import { Badge } from './badge';

export const nav: NavPath = 'Primitives/Badge';

/**
 * Three neutral variants and four semantic ones. The semantic pills are tinted, a 10% fill of the
 * token under its text.
 */
export const Variants = createPreview(() => (
  <div className="flex flex-wrap items-center gap-3">
    <Badge content="Default" />
    <Badge content="Secondary" variants={{ variant: 'secondary' }} />
    <Badge content="Outline" variants={{ variant: 'outline' }} />
    <Badge content="Allowed" variants={{ variant: 'success' }} />
    <Badge content="Allowed" variants={{ variant: 'warning' }} />
    <Badge content="Denied" variants={{ variant: 'critical' }} />
    <Badge content="Info" variants={{ variant: 'info' }} />
  </div>
));

/** `sm` is the count pill: beside a tab label, or at the end of a filter row. */
export const Sizes = createPreview(() => (
  <div className="flex items-center gap-6 text-sm">
    <span className="inline-flex items-center gap-2">
      Attributes
      <Badge content="12" variants={{ variant: 'secondary', size: 'sm' }} />
    </span>
    <span className="inline-flex items-center gap-2">
      Attributes
      <Badge content="12" variants={{ variant: 'secondary' }} />
    </span>
  </div>
));

/** `mono` for an identifier rather than a word: a permission key, a resource id. */
export const Mono = createPreview(() => (
  <div className="flex flex-wrap items-center gap-2">
    <Badge content="organization:describe" variants={{ variant: 'outline', mono: true }} />
    <Badge content="project:describe" variants={{ variant: 'outline', mono: true }} />
    <Badge content="No targets selected." variants={{ variant: 'critical', mono: true }} />
    <Badge content="1,204" variants={{ variant: 'secondary', size: 'sm', mono: true }} />
  </div>
));

export const InContext = createPreview(() => (
  <div className="flex flex-col gap-3 text-sm">
    <div className="flex items-center gap-2">
      <span className="text-fg-default">production</span>
      <Badge content="3 subgraphs" variants={{ variant: 'secondary' }} />
    </div>
    <div className="flex items-center gap-2">
      <span className="text-fg-default">checkout-service</span>
      <Badge content="breaking" variants={{ variant: 'critical' }} />
    </div>
    <div className="flex items-center gap-2">
      <span className="text-fg-default">v2.4.0</span>
      <Badge content="latest" variants={{ variant: 'outline' }} />
    </div>
  </div>
));

/**
 * `outline` is a step lighter than the filled variants, which is what the two qualifying call
 * sites ("3 mappings", "+2 more") were reaching for with a `font-normal` class of their own.
 */
export const Weights = createPreview(() => (
  <div className="flex items-center gap-3">
    <Badge content="font-medium" />
    <Badge content="font-normal" variants={{ variant: 'outline' }} />
  </div>
));

function CompositionErrorText(props: { padding: 'default' | 'tight' }) {
  const badge = (content: string) => (
    <Badge content={content} variants={{ variant: 'warning', padding: props.padding }} />
  );
  return (
    <ul className="w-80 text-sm">
      <li className="mb-1 ml-[1.25em] list-[square] pl-0 marker:pl-1">
        [orders] Field {badge('Product.sku')} is marked {badge('@external')} but is not used in any
        federation directive ({badge('@key,')} {badge('@provides,')} {badge('@requires)')} or to
        satisfy an interface; the field declaration has no use and should be removed (or the field
        should not be {badge('@external)')}.
      </li>
    </ul>
  );
}

/**
 * `tight` drops the vertical padding for a badge inside running text, so a wrapped line of
 * badges doesn't touch the one above. Shown with a composition error from a schema check.
 */
/** A leading icon takes the badge's text colour, at a size matched to the badge's. */
export const WithIcon = createPreview(() => (
  <div className="flex flex-col gap-3">
    <div className="flex items-center gap-2">
      <Badge icon={ActivityIcon} content="2 clients" variants={{ variant: 'critical' }} />
      <Badge icon={TriangleAlertIcon} content="Unapproved" variants={{ variant: 'warning' }} />
      <Badge icon={CheckIcon} content="Approved" variants={{ variant: 'success' }} />
      <Badge icon={ActivityIcon} content="Outline" variants={{ variant: 'outline' }} />
    </div>
    <div className="flex items-center gap-2">
      <Badge
        icon={ActivityIcon}
        content="1 client"
        variants={{ variant: 'critical', size: 'sm' }}
      />
      <Badge icon={CheckIcon} content="sm" variants={{ variant: 'success', size: 'sm' }} />
    </div>
  </div>
));

// A short badge with its full sentence on hover.
export const WithTooltip = createPreview(() => (
  <div className="flex items-center gap-2">
    <Badge
      icon={ActivityIcon}
      content="2 clients"
      tooltip="10+ operations by 2 clients affected"
      variants={{ variant: 'critical' }}
    />
    <Badge
      icon={BoxIcon}
      content="101 deployments"
      tooltip="101 app deployments affected"
      variants={{ variant: 'warning' }}
    />
    <Badge
      icon={CheckIcon}
      content="Approved"
      tooltip="Approved by User on 20th October 2026"
      variants={{ variant: 'success' }}
    />
    <Badge
      content="Usage not tracked"
      tooltip="Usage isn't tracked for this kind of change, so it can't be called safe"
      variants={{ variant: 'secondary' }}
    />
  </div>
));

export const Padding = createPreview(() => (
  <div className="flex gap-8">
    <div className="flex flex-col gap-2">
      <span className="text-xs text-fg-secondary">default</span>
      <CompositionErrorText padding="default" />
    </div>
    <div className="flex flex-col gap-2">
      <span className="text-xs text-fg-secondary">tight</span>
      <CompositionErrorText padding="tight" />
    </div>
  </div>
));

export const Truncation = createPreview(() => (
  <div className="w-48">
    <Badge content="a-very-long-badge-label-that-overflows" variants={{ variant: 'secondary' }} />
  </div>
));

export const Playground = createPreview({
  controls: controlsFor(Badge, {
    content: { type: 'text', default: 'Badge' },
    variants: {
      variant: {
        type: 'select',
        options: ['default', 'secondary', 'outline', 'success', 'warning', 'critical', 'info'],
        default: 'default',
      },
      size: { type: 'radio', options: ['default', 'sm'], default: 'default' },
      padding: { type: 'radio', options: ['default', 'tight'], default: 'default' },
      mono: { type: 'boolean', default: false },
    },
  }),
  render: v => <Badge content={v.content} variants={v.variants} />,
});
