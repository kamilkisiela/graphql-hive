import { useState } from 'react';
import { controlsFor, createPreview, type NavPath } from 'react-foundry';
import { Button } from '../../button/button';
import { Input } from '../../input/input';
import { ScrollArea } from '../../scroll-area/scroll-area';
import { Sheet } from './sheet';
import * as styles from './sheet.preview.css';

export const nav: NavPath = 'Primitives/Overlays/Sheet';

/**
 * A panel from the right edge, for a task with more to it than a dialog holds: the token and SSO
 * forms, the trace details. The header stays at the top and the footer at the bottom while the
 * body scrolls.
 */

function TokenFields({ count = 3 }: { count?: number }) {
  return (
    <div className={styles.tokenFieldsDiv}>
      <label className={styles.tokenFieldsLabel}>
        Title
        <Input onSurface="raised" placeholder="CI deploy token" />
      </label>
      <label className={styles.tokenFieldsLabel2}>
        Description
        <Input onSurface="raised" placeholder="Publishes the gateway schema from CI" />
      </label>
      {Array.from({ length: count }, (_, i) => (
        <label key={i} className={styles.tokenFieldsLabel3}>
          Permission {i + 1}
          <Input onSurface="raised" placeholder="schema:publish" />
        </label>
      ))}
    </div>
  );
}

export const Default = createPreview(() => {
  const [open, setOpen] = useState(false);
  return (
    <Sheet
      open={open}
      onOpenChange={setOpen}
      trigger={<Button variant="primary">Create access token</Button>}
      title="Create access token"
      description="Scope the token to the resources and permissions it needs."
      footer={
        <>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button variant="primary" onClick={() => setOpen(false)}>
            Create
          </Button>
        </>
      }
    >
      <TokenFields />
    </Sheet>
  );
});

/** `md` is the default; `half` is the trace panels. */
export const Widths = createPreview(() => (
  <div className={styles.div}>
    {(['md', 'lg', 'half'] as const).map(width => (
      <Sheet
        key={width}
        width={width}
        trigger={<Button>{width}</Button>}
        title={`Width ${width}`}
        description="Full width below the sm breakpoint, then capped at this width's max-width."
        footer={<Button variant="primary">Done</Button>}
      >
        <TokenFields />
      </Sheet>
    ))}
  </div>
));

/** Enough fields to scroll: the footer stays pinned and the header stays put. */
export const LongContent = createPreview(() => (
  <Sheet
    trigger={<Button>Connect OIDC provider</Button>}
    title="Connect OpenID Connect provider"
    description="Members can sign in through the provider once it is connected."
    footer={
      <>
        <Button variant="outline">Cancel</Button>
        <Button variant="primary">Connect</Button>
      </>
    }
  >
    <TokenFields count={14} />
  </Sheet>
));

/**
 * `padding="none"`: a body that draws its own rows to the edges and scrolls on its own, like the
 * trace tree.
 */
export const EdgeToEdge = createPreview(() => (
  <Sheet
    trigger={<Button>Span details</Button>}
    width="half"
    padding="none"
    title={
      <>
        Span Details
        <span className={styles.span}>a3f9</span>
      </>
    }
    description="Span ID: a3f9c2d1e8b74f60"
  >
    <ScrollArea fill>
      <ul className={styles.ul}>
        {[
          'http.method GET',
          'http.route /graphql',
          'graphql.operation.name GetUser',
          'db.system postgres',
        ].map(row => (
          <li key={row} className={styles.li}>
            {row}
          </li>
        ))}
      </ul>
    </ScrollArea>
  </Sheet>
));

export const Playground = createPreview({
  controls: controlsFor(Sheet, {
    title: { type: 'text', default: 'Create access token' },
    description: {
      type: 'text',
      default: 'Scope the token to the resources and permissions it needs.',
    },
    width: { type: 'radio', options: ['md', 'lg', 'half'], default: 'md' },
    padding: { type: 'radio', options: ['default', 'none'], default: 'default' },
  }),
  render: v => (
    <Sheet
      trigger={<Button variant="primary">Open</Button>}
      title={v.title}
      description={v.description}
      width={v.width}
      padding={v.padding}
      footer={<Button variant="primary">Done</Button>}
    >
      <TokenFields />
    </Sheet>
  ),
});
