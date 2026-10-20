import { useState } from 'react';
import { controlsFor, createPreview, type NavPath } from 'react-foundry';
import { Button } from '../../button/button';
import { Input } from '../../input/input';
import { Label } from '../../label/label';
import { ScrollArea } from '../../scroll-area/scroll-area';
import { Sheet } from './sheet';

export const nav: NavPath = 'Primitives/Overlays/Sheet';

/**
 * A panel from the right edge, for a task with more to it than a dialog holds: the token and SSO
 * forms, the trace details. The header stays at the top and the footer at the bottom while the
 * body scrolls.
 */

function TokenFields({ count = 3 }: { count?: number }) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="token-title" label="Title" />
        <Input id="token-title" onSurface="raised" placeholder="CI deploy token" />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="token-description" label="Description" />
        <Input
          id="token-description"
          onSurface="raised"
          placeholder="Publishes the gateway schema from CI"
        />
      </div>
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="flex flex-col gap-1.5">
          <Label htmlFor={`token-permission-${i}`} label={`Permission ${i + 1}`} />
          <Input id={`token-permission-${i}`} onSurface="raised" placeholder="schema:publish" />
        </div>
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
  <div className="flex flex-wrap gap-3">
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
        <span className="ml-2 font-mono font-normal text-fg-secondary">a3f9</span>
      </>
    }
    description="Span ID: a3f9c2d1e8b74f60"
  >
    <ScrollArea fill>
      <ul className="divide-y divide-line border-t border-line text-sm">
        {[
          'http.method GET',
          'http.route /graphql',
          'graphql.operation.name GetUser',
          'db.system postgres',
        ].map(row => (
          <li key={row} className="px-6 py-3 font-mono text-fg-default">
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
