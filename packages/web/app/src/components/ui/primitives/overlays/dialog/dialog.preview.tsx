import { useState } from 'react';
import { controlsFor, createPreview, type NavPath } from 'react-foundry';
import { Button } from '../../button/button';
import { Input } from '../../input/input';
import { Label } from '../../label/label';
import { Dialog } from './dialog';

export const nav: NavPath = 'Primitives/Overlays/Dialog';

/**
 * A centred modal with a title, an optional description, a body that scrolls once the dialog
 * reaches the viewport height, and a right-aligned footer.
 *
 * Every preview opens from a button, since a dialog rendered open cannot show its backdrop, its
 * focus trap or its way out.
 */

function CollectionFields() {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="collection-name" label="Collection Name" />
        <Input id="collection-name" onSurface="raised" placeholder="Checkout" />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="collection-description" label="Collection Description" />
        <Input
          id="collection-description"
          onSurface="raised"
          placeholder="Operations the checkout flow runs"
        />
      </div>
    </div>
  );
}

export const Default = createPreview(() => {
  const [open, setOpen] = useState(false);
  return (
    <Dialog
      open={open}
      onOpenChange={setOpen}
      trigger={<Button variant="primary">Create collection</Button>}
      title="Create collection"
      description="Collections keep related operations together in the laboratory."
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
      <CollectionFields />
    </Dialog>
  );
});

/** The four widths. `md` is the default. */
export const Widths = createPreview(() => (
  <div className="flex flex-wrap gap-3">
    {(['sm', 'md', 'lg', 'xl'] as const).map(width => (
      <Dialog
        key={width}
        width={width}
        trigger={<Button>{width}</Button>}
        title={`Width ${width}`}
        description="The dialog is full width below this width's max-width and never wider than it."
        footer={<Button variant="primary">Done</Button>}
      >
        <p className="text-sm text-fg-default">
          Contracts, delete confirmations and most forms sit at md. Role editors and the OIDC debug
          view need xl.
        </p>
      </Dialog>
    ))}
  </div>
));

/** The header and footer stay put; the body scrolls. */
export const LongContent = createPreview(() => (
  <Dialog
    trigger={<Button>Edit your Preflight Script</Button>}
    width="lg"
    title="Edit your Preflight Script"
    description={
      <>
        This script will run in each user's browser and be stored in plain text on our servers.
        Don't share any secrets here.
        <br />
        All team members can view the script and toggle it off when they need to.
      </>
    }
    footer={
      <>
        <Button variant="outline">Close</Button>
        <Button variant="primary">Save</Button>
      </>
    }
  >
    <div className="flex flex-col gap-3 text-sm">
      {Array.from({ length: 24 }, (_, i) => (
        <p key={i} className="text-fg-default">
          Line {i + 1}: lab.environment.set('token', await fetch('/auth').then(r =&gt; r.text()))
        </p>
      ))}
    </div>
  </Dialog>
));

/** No × and no backdrop dismissal: the prompt, which has to be answered. */
export const Locked = createPreview(() => {
  const [open, setOpen] = useState(false);
  return (
    <Dialog
      open={open}
      onOpenChange={setOpen}
      trigger={<Button>Rename operation</Button>}
      title="Rename operation"
      closeButton={false}
      dismissible={false}
      footer={
        <>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button variant="primary" onClick={() => setOpen(false)}>
            OK
          </Button>
        </>
      }
    >
      <Input onSurface="raised" defaultValue="GetUser" aria-label="Operation name" />
    </Dialog>
  );
});

export const Playground = createPreview({
  controls: controlsFor(Dialog, {
    title: { type: 'text', default: 'Create collection' },
    description: {
      type: 'text',
      default: 'Collections keep related operations together in the laboratory.',
    },
    width: { type: 'radio', options: ['sm', 'md', 'lg', 'xl'], default: 'md' },
    closeButton: { type: 'boolean', default: true },
    dismissible: { type: 'boolean', default: true },
  }),
  render: v => (
    <Dialog
      trigger={<Button variant="primary">Open</Button>}
      title={v.title}
      description={v.description}
      width={v.width}
      closeButton={v.closeButton}
      dismissible={v.dismissible}
      footer={<Button variant="primary">Done</Button>}
    >
      <CollectionFields />
    </Dialog>
  ),
});
