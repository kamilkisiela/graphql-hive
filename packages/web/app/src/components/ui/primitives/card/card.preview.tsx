import { controlsFor, createPreview, type NavPath } from 'react-foundry';
import { Card } from './card';
import * as styles from './card.preview.css';

export const nav: NavPath = 'Primitives/Card';

export const Default = createPreview(() => (
  <Card title="Alert rule" description="Notify the team when p99 latency crosses the threshold.">
    <p className={styles.p}>Evaluated every 5 minutes against the last hour.</p>
  </Card>
));

/** No children, so the card is just its heading block. */
export const WithoutContent = createPreview(() => (
  <Card title="Schema checks" description="No checks have run for this target yet." />
));

/** `description` takes a node as well as a string, which is how call sites get a link into it. */
export const RichDescription = createPreview(() => (
  <Card
    title="Destination"
    description={
      <>
        Select the target destination for this alert. Configure destinations{' '}
        <a href="#" className={styles.a}>
          here
        </a>
        .
      </>
    }
  />
));

/** Title with no description, the shape the SSO settings cards use. */
export const TitleOnly = createPreview(() => (
  <Card title="SCIM Provision Defaults">
    <p className={styles.p2}>Applied to every user provisioned via SCIM.</p>
  </Card>
));

/**
 * Children with no title or description. No call site does this yet, but it is the branch where
 * the body owns its own top inset, so it is the one to check if a card ever ships headerless.
 */
export const ContentOnly = createPreview(() => (
  <Card>
    <p className={styles.p3}>
      Padding is even on all four sides here, since there is no heading block above to supply it.
    </p>
  </Card>
));

/**
 * The two surfaces side by side. Foundry's canvas is set to the app's own page background in
 * `foundry.config.ts` (neutral-3 light, neutral-2 dark), so this compares them on the surface
 * they actually ship against. Worth checking in both themes: `raised` swaps its fill between
 * them and `base` does not.
 */
export const OnSurface = createPreview(() => (
  <div className={styles.div}>
    <Card variants={{ onSurface: 'base' }} title="Base" description="Border only, no fill." />
    <Card
      variants={{ onSurface: 'raised' }}
      title="Raised"
      description="Filled, one step off the page."
    />
  </div>
));

/**
 * `interactive` is for a card that is itself a link or button, so it has to be hovered to show
 * anything. Both surfaces are here because the hover fill is shared between them: check it reads
 * as a lift on `raised` and does not look like a fill appearing from nowhere on `base`.
 */
export const Interactive = createPreview(() => (
  <div className={styles.div2}>
    <Card
      variants={{ onSurface: 'base', interactive: true }}
      title="Base"
      description="Hover me."
    />
    <Card
      variants={{ onSurface: 'raised', interactive: true }}
      title="Raised"
      description="Hover me. This is the project card's surface."
    />
  </div>
));

/**
 * `bodyPadding: 'none'` for content that runs to the card edge. The project card is the reason it
 * exists: a full-bleed sparkline with a text row under it that carries its own `px-4`. The card
 * supplies the vertical inset itself, since dropping the padding drops all four sides.
 */
export const BodyPadding = createPreview(() => (
  <div className={styles.div3}>
    <Card variants={{ onSurface: 'raised' }} title="Default">
      <div className={styles.div4}>Inset by the card's p-5</div>
    </Card>
    <Card variants={{ onSurface: 'raised', bodyPadding: 'none' }} title="None">
      <div className={styles.div5}>Runs to the edge</div>
    </Card>
  </div>
));

/**
 * `large` heads a page section; `xlarge` is the auth card, which is the whole page rather than a
 * section of one. The description does not scale with the title, so the thing to check here is
 * that it still reads as secondary at `xlarge` rather than looking orphaned under it.
 */
export const TitleSize = createPreview(() => (
  <div className={styles.div6}>
    <Card
      variants={{ titleSize: 'default' }}
      title="Default"
      description="text-sm, the size the insights stat cards render at."
    />
    <Card
      variants={{ titleSize: 'large' }}
      title="Large"
      description="text-lg, for section-heading cards."
    />
    <Card
      variants={{ titleSize: 'xlarge' }}
      title="Extra large"
      description="text-2xl, for auth cards, which own the whole page."
    />
  </div>
));

export const Playground = createPreview({
  controls: controlsFor(Card, {
    variants: {
      onSurface: { type: 'radio', options: ['base', 'raised'], default: 'base' },
      titleSize: { type: 'radio', options: ['default', 'large', 'xlarge'], default: 'default' },
      bodyPadding: { type: 'radio', options: ['default', 'none'], default: 'default' },
      interactive: { type: 'boolean', default: false },
    },
    title: { type: 'text', default: 'Alert rule' },
    description: { type: 'text', default: 'Notify the team when p99 latency crosses.' },
    children: {
      type: 'boolean',
      label: 'Body',
      default: true,
      // Tinted so `bodyPadding` is visible; off, the card is just its heading block.
      derive: on => (on ? <div className={styles.div7}>Body</div> : undefined),
    },
  }),
  render: v => (
    <Card variants={v.variants} title={v.title} description={v.description}>
      {v.children}
    </Card>
  ),
});
