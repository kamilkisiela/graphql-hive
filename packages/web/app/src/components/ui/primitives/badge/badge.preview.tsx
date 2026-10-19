import { ActivityIcon, CheckIcon, TriangleAlertIcon } from 'lucide-react';
import { controlsFor, createPreview, type NavPath } from 'react-foundry';
import { Badge } from './badge';
import * as styles from './badge.preview.css';

export const nav: NavPath = 'Primitives/Badge';

/**
 * Three neutral variants and four semantic ones. The semantic pills are tinted, a 10% fill of the
 * token under its text.
 */
export const Variants = createPreview(() => (
  <div className={styles.div}>
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
  <div className={styles.div2}>
    <span className={styles.span}>
      Attributes
      <Badge content="12" variants={{ variant: 'secondary', size: 'sm' }} />
    </span>
    <span className={styles.span2}>
      Attributes
      <Badge content="12" variants={{ variant: 'secondary' }} />
    </span>
  </div>
));

/** `mono` for an identifier rather than a word: a permission key, a resource id. */
export const Mono = createPreview(() => (
  <div className={styles.div3}>
    <Badge content="organization:describe" variants={{ variant: 'outline', mono: true }} />
    <Badge content="project:describe" variants={{ variant: 'outline', mono: true }} />
    <Badge content="No targets selected." variants={{ variant: 'critical', mono: true }} />
    <Badge content="1,204" variants={{ variant: 'secondary', size: 'sm', mono: true }} />
  </div>
));

export const InContext = createPreview(() => (
  <div className={styles.div4}>
    <div className={styles.div5}>
      <span className={styles.span3}>production</span>
      <Badge content="3 subgraphs" variants={{ variant: 'secondary' }} />
    </div>
    <div className={styles.div6}>
      <span className={styles.span4}>checkout-service</span>
      <Badge content="breaking" variants={{ variant: 'critical' }} />
    </div>
    <div className={styles.div7}>
      <span className={styles.span5}>v2.4.0</span>
      <Badge content="latest" variants={{ variant: 'outline' }} />
    </div>
  </div>
));

/**
 * `outline` is a step lighter than the filled variants, which is what the two qualifying call
 * sites ("3 mappings", "+2 more") were reaching for with a `font-normal` class of their own.
 */
export const Weights = createPreview(() => (
  <div className={styles.div8}>
    <Badge content="font-medium" />
    <Badge content="font-normal" variants={{ variant: 'outline' }} />
  </div>
));

function CompositionErrorText(props: { padding: 'default' | 'tight' }) {
  const badge = (content: string) => (
    <Badge content={content} variants={{ variant: 'warning', padding: props.padding }} />
  );
  return (
    <ul className={styles.compositionErrorTextUl}>
      <li className={styles.compositionErrorTextLi}>
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
  <div className={styles.div9}>
    <div className={styles.div10}>
      <Badge
        icon={ActivityIcon}
        content="10+ operations by 2 clients affected"
        variants={{ variant: 'critical' }}
      />
      <Badge icon={TriangleAlertIcon} content="Unapproved" variants={{ variant: 'warning' }} />
      <Badge icon={CheckIcon} content="Approved" variants={{ variant: 'success' }} />
      <Badge icon={ActivityIcon} content="Outline" variants={{ variant: 'outline' }} />
    </div>
    <div className={styles.div11}>
      <Badge
        icon={ActivityIcon}
        content="3 operations by 1 client affected"
        variants={{ variant: 'critical', size: 'sm' }}
      />
      <Badge icon={CheckIcon} content="sm" variants={{ variant: 'success', size: 'sm' }} />
    </div>
  </div>
));

export const Padding = createPreview(() => (
  <div className={styles.div12}>
    <div className={styles.div13}>
      <span className={styles.span6}>default</span>
      <CompositionErrorText padding="default" />
    </div>
    <div className={styles.div14}>
      <span className={styles.span7}>tight</span>
      <CompositionErrorText padding="tight" />
    </div>
  </div>
));

export const Truncation = createPreview(() => (
  <div className={styles.div15}>
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
