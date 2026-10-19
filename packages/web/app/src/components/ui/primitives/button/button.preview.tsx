import { ChevronDown, Copy, ListFilter, Plus, RefreshCw, X } from 'lucide-react';
import { controlsFor, createPreview, type NavPath } from 'react-foundry';
import { Button } from './button';
import * as styles from './button.preview.css';

export const nav: NavPath = 'Primitives/Button';

export const Variants = createPreview(() => (
  <div className={styles.div}>
    <Button variant="primary">Save alert</Button>
    <Button variant="outline">Add destination</Button>
    <Button variant="ghost">Cancel</Button>
    <Button variant="destructive">Delete</Button>
  </div>
));

export const TriggerVariants = createPreview(() => (
  <div className={styles.div2}>
    <Button label="Default" />
    <Button label="Active" variant="active" />
    <Button label="Save this filter view" variant="action" />
    <Button label="Muted action" variant="muted-action" />
  </div>
));

/**
 * The two `controlSize` values, one row each, across the three layouts. `default` (36px) is a
 * form control; `compact` (30px) is filter chrome. An icon-only button is a square at either size.
 * `icon-sm` (28px) is the square for a close or clear icon inside something else and is not a
 * `controlSize`.
 */
export const Sizes = createPreview(() => (
  <div className={styles.div3}>
    <div className={styles.div4}>
      <span className={styles.span}>default</span>
      <Button variant="primary">Save alert</Button>
      <Button label="Last 7 days" rightIcon={{ icon: ChevronDown, withSeparator: true }} />
      <Button layout="iconOnly" icon={RefreshCw} aria-label="Refresh" />
    </div>
    <div className={styles.div5}>
      <span className={styles.span2}>compact</span>
      <Button variant="primary" size="compact">
        Save alert
      </Button>
      <Button
        label="Last 7 days"
        size="compact"
        rightIcon={{ icon: ChevronDown, withSeparator: true }}
      />
      <Button layout="iconOnly" icon={RefreshCw} aria-label="Refresh" size="compact" />
    </div>
    <div className={styles.div6}>
      <span className={styles.span3}>icon-sm</span>
      <Button variant="ghost" size="icon-sm">
        <X className={styles.x} />
      </Button>
    </div>
  </div>
));

export const Segmented = createPreview(() => (
  <div className={styles.div7}>
    <Button label="Last 7 days" rightIcon={{ icon: ChevronDown, withSeparator: true }} />
    <Button label="Filter" rightIcon={{ icon: ListFilter, withSeparator: false }} />
    <Button label="Copy JSON Schema" rightIcon={{ icon: Copy, withSeparator: true }} />
    <Button
      label="Clients"
      accessoryInformation="3 clients"
      rightIcon={{ icon: X, label: 'Clear clients', withSeparator: true, action: () => {} }}
    />
  </div>
));

export const IconOnly = createPreview(() => (
  <div className={styles.div8}>
    <Button layout="iconOnly" icon={RefreshCw} aria-label="Refresh" />
    <Button layout="iconOnly" icon={RefreshCw} aria-label="Refresh" variant="active" />
    <Button layout="iconOnly" icon={RefreshCw} aria-label="Refresh" variant="action" />
  </div>
));

export const WithIcon = createPreview(() => (
  <Button variant="outline">
    <Plus className={styles.plus} />
    Add another destination
  </Button>
));

/** Text that acts, inline with the copy around it: no box, accent, underlined on hover. */
export const Link = createPreview(() => (
  <p className={styles.p}>
    The schema check failed on a breaking change.{' '}
    <Button variant="link">See the affected deployments</Button> before approving it, or{' '}
    <Button variant="link" disabled>
      request a re-run
    </Button>{' '}
    once the queue clears.
  </p>
));

/**
 * A button that navigates. `anchor` renders an `<a>` for links out; `render` takes the router
 * `<Link>` for links within the app and merges the button's classes, ref and handlers onto it.
 * Anchors stand in for the router here.
 */
export const AsLink = createPreview(() => (
  <div className={styles.div9}>
    <Button width="full" anchor={{ href: '#' }}>
      Go to your organization
    </Button>
    <Button variant="outline" width="full" anchor={{ href: '#' }}>
      Sign in instead
    </Button>
    <div>
      <Button variant="ghost" size="compact" anchor={{ href: '#' }}>
        Back to traces
      </Button>
    </div>
  </div>
));

export const Disabled = createPreview(() => (
  <div className={styles.div10}>
    <Button variant="primary" disabled>
      Saving...
    </Button>
    <Button label="Disabled trigger" disabled />
  </div>
));

/**
 * `width="full"` is the modal-footer and auth-form shape: a pair of full-width buttons sharing a
 * row.
 */
export const FullWidth = createPreview(() => (
  <div className={styles.div11}>
    <Button variant="primary" width="full">
      Create organization
    </Button>
    <div className={styles.div12}>
      <Button variant="outline" width="full">
        Cancel
      </Button>
      <Button variant="primary" width="full">
        Save changes
      </Button>
    </div>
  </div>
));

/** Without `raised`, the default fill disappears into a dialog or sheet in dark mode. */
export const OnRaisedSurface = createPreview(() => (
  <div className={styles.div13}>
    <div className={styles.div14}>
      <Button type="submit" width="full" onSurface="raised">
        Sign in
      </Button>
      <Button variant="outline" width="full">
        Login with GitHub
      </Button>
    </div>
    <div className={styles.div15}>
      <div className={styles.div16}>
        <Button variant="outline">Cancel</Button>
        <Button onSurface="raised">Transfer this organization</Button>
      </div>
      <div className={styles.div17}>
        <Button variant="outline" width="full">
          Cancel
        </Button>
        <Button width="full" onSurface="raised">
          Add Operation
        </Button>
      </div>
    </div>
  </div>
));

export const Playground = createPreview({
  controls: controlsFor(Button, {
    children: { type: 'text', default: 'Save alert' },
    variant: {
      type: 'select',
      options: [
        'default',
        'active',
        'action',
        'muted-action',
        'primary',
        'outline',
        'ghost',
        'destructive',
        'link',
      ],
      default: 'primary',
    },
    size: { type: 'radio', options: ['default', 'compact'], default: 'default' },
    width: { type: 'radio', options: ['auto', 'full'], default: 'auto' },
    onSurface: { type: 'radio', options: ['base', 'raised'], default: 'base' },
    disabled: { type: 'boolean', default: false },
  }),
  render: v => (
    <div className={styles.div18}>
      <Button
        variant={v.variant}
        size={v.size}
        width={v.width}
        onSurface={v.onSurface}
        disabled={v.disabled}
      >
        {v.children}
      </Button>
    </div>
  ),
});

const RIGHT_ICONS = { chevron: ChevronDown, filter: ListFilter, copy: Copy, clear: X };

/** The segmented `label` layout: a select, menu or filter trigger. */
export const TriggerPlayground = createPreview({
  controls: controlsFor(Button, {
    label: { type: 'text', default: 'Last 7 days' },
    accessoryInformation: {
      type: 'text',
      default: '',
      // The component tests `!= null`, so an empty string would draw an empty segment.
      derive: text => text || undefined,
    },
    rightIcon: {
      type: 'select',
      options: ['none', 'chevron', 'filter', 'copy', 'clear'],
      default: 'chevron',
      derive: name =>
        name === 'none' ? undefined : { icon: RIGHT_ICONS[name], withSeparator: true },
    },
    variant: {
      type: 'select',
      options: ['default', 'active', 'action', 'muted-action'],
      default: 'default',
    },
    size: { type: 'radio', options: ['default', 'compact'], default: 'default' },
    onSurface: { type: 'radio', options: ['base', 'raised'], default: 'base' },
    disabled: { type: 'boolean', default: false },
  }),
  render: v => (
    <Button
      label={v.label}
      accessoryInformation={v.accessoryInformation}
      rightIcon={v.rightIcon}
      variant={v.variant}
      size={v.size}
      onSurface={v.onSurface}
      disabled={v.disabled}
    />
  ),
});
