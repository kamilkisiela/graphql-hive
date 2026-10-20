import { useState } from 'react';
import { CircleHelp, Copy, Info } from 'lucide-react';
import { controlsFor, createPreview, type NavPath } from 'react-foundry';
import { Button } from '../../button/button';
import { Popover } from '../popover/popover';
import { Tooltip } from './tooltip';

export const nav: NavPath = 'Primitives/Floating/Tooltip';

/**
 * A hover and focus hint on an element that already does something. `trigger` is that element
 * and `content` is what it says, so there is nothing to compose and no `className` to pass.
 *
 * One delay for the whole app, set on the `TooltipProvider` at the root; there is no per-tooltip
 * delay prop. Foundry mounts the same provider.
 *
 * Deliberately smaller than the other floating panels: a tooltip explains the surface it sits
 * over, so it should not read as large as that surface.
 */
export const Default = createPreview(() => (
  <Tooltip trigger={<Button label="Hover me" />} content="Runs a check against the registry." />
));

/** The common case: an icon button whose action the hint names. */
export const IconButtonTrigger = createPreview(() => (
  <Tooltip
    trigger={<Button layout="iconOnly" icon={Copy} aria-label="Copy access token" />}
    content="Copy access token"
  />
));

/**
 * A string trigger is wrapped in a focusable span, so keyboard users can reach the hint. For a
 * value that is truncated or abbreviated on screen.
 */
export const StringTrigger = createPreview(() => (
  <span className="font-mono text-xs uppercase">
    <Tooltip trigger="Sep 10 14:22:07" content="2026-09-10T14:22:07.481Z" side="bottom" />
  </span>
));

/**
 * The width caps. `default` keeps a long hint to a few lines; `md` and `lg` are for a real
 * paragraph; `screen` is for a value that must not wrap at all.
 */
export const MaxWidths = createPreview(() => {
  const long =
    'This differs from request count because a single request can resolve a field many times, or skip it entirely.';
  return (
    <div className="flex flex-wrap gap-3">
      <Tooltip trigger={<Button label="default" />} content={long} />
      <Tooltip trigger={<Button label="md" />} content={long} maxWidth="md" />
      <Tooltip trigger={<Button label="lg" />} content={long} maxWidth="lg" />
      <Tooltip
        trigger={<Button label="screen" />}
        content="Query.productsConnection.edges.node.reviews.author.displayName"
        maxWidth="screen"
      />
    </div>
  );
});

/** `padding="lg"` with `maxWidth="lg"` is the paragraph shape: an explanation, not a label. No app call site uses it yet. */
export const Paragraph = createPreview(() => (
  <Tooltip
    trigger={
      <Button layout="iconOnly" icon={CircleHelp} variant="ghost" aria-label="Why inactive" />
    }
    content={
      <p>
        The organization owner has full access to everything within the organization. The role of
        the owner can not be changed.
      </p>
    }
    maxWidth="lg"
    padding="lg"
  />
));

/** `content` takes a node, so it can carry structure rather than one line. */
export const RichContent = createPreview(() => (
  <Tooltip
    trigger={<Button label="Impact" />}
    content={
      <>
        <p className="mb-1 font-medium">Impact</p>
        <p>Total time spent on this operation in the selected period, in seconds.</p>
      </>
    }
  />
));

/** All four sides. `top` is the default. */
export const Sides = createPreview(() => (
  <div className="flex gap-3 p-16">
    {(['top', 'right', 'bottom', 'left'] as const).map(side => (
      <Tooltip
        key={side}
        trigger={<Button label={side} />}
        content={`Positioned ${side}.`}
        side={side}
      />
    ))}
  </div>
));

/** `arrow` points at the trigger, for when the association is not obvious from position alone. */
export const WithArrow = createPreview(() => (
  <div className="flex gap-3">
    <Tooltip trigger={<Button label="No arrow" />} content="The default." />
    <Tooltip trigger={<Button label="With arrow" />} content="Points at its trigger." arrow />
  </div>
));

/**
 * Grouping: once one tooltip is showing, moving to the next in the row opens it instantly
 * instead of waiting the delay again. Hover across all three.
 */
export const Grouping = createPreview(() => (
  <div className="flex gap-3">
    <Tooltip trigger={<Button label="First" />} content="Waits the delay." />
    <Tooltip trigger={<Button label="Second" />} content="Opens at once." />
    <Tooltip trigger={<Button label="Third" />} content="Opens at once." />
  </div>
));

/**
 * `disableHoverablePopup` closes the hint as soon as the pointer leaves the trigger, rather than
 * letting it travel into the popup. For a hint over a table row the popup would otherwise cover.
 */
export const NotHoverable = createPreview(() => (
  <div className="flex gap-3">
    <Tooltip
      trigger={<Button label="Hoverable" />}
      content="You can move the pointer into this."
      side="bottom"
    />
    <Tooltip
      trigger={<Button label="Not hoverable" />}
      content="This closes as you leave the button."
      side="bottom"
      disableHoverablePopup
    />
  </div>
));

/** Controlled and `defaultOpen`. The app uses `open` to force a hint on a disabled button. */
export const Controlled = createPreview(() => {
  const [open, setOpen] = useState(true);
  return (
    <div className="flex items-center gap-3 pt-10">
      <Tooltip
        open={open}
        onOpenChange={setOpen}
        trigger={<Button label={open ? 'Open (controlled)' : 'Closed (controlled)'} />}
        content="Held open by the call site."
      />
      <Button variant="outline" onClick={() => setOpen(o => !o)}>
        Toggle
      </Button>
      <Tooltip
        defaultOpen
        trigger={<Button label="defaultOpen" />}
        content="Open on first render, then on its own."
      />
    </div>
  );
});

/**
 * `disabled` turns it off without removing it from the tree, for a trigger whose explanation only
 * applies in some states. The left one never opens.
 */
export const Disabled = createPreview(() => (
  <div className="flex gap-3">
    <Tooltip trigger={<Button label="Disabled" />} content="You will not see this." disabled />
    <Tooltip trigger={<Button label="Enabled" />} content="You will see this." />
  </div>
));

/**
 * A trigger with `pointer-events-none`, such as a disabled control, never receives hover, so the
 * tooltip would never open. Wrap it and put the tooltip on the wrapper instead. The left button
 * is the trap; the right one is the fix. If the reason matters, say it inline or in a Popover:
 * a disabled control is not keyboard-reachable either way.
 */
export const DisabledControl = createPreview(() => (
  <div className="flex gap-3">
    <Tooltip trigger={<Button label="Never opens" disabled />} content="You will not see this." />
    <Tooltip
      trigger={
        <span className="inline-flex">
          <Button label="Opens" disabled />
        </span>
      }
      content="The wrapper takes the hover."
    />
  </div>
));

/** Info icons are a Popover with `openOnHover`, not a Tooltip, so touch and keyboard can open them. */
export const Infotip = createPreview(() => (
  <div className="flex items-center gap-6">
    <Popover
      trigger={
        <button type="button" aria-label="Why this cannot be assigned">
          <Info className="size-4" />
        </button>
      }
      openOnHover
      content={
        <p className="text-sm text-fg-default">
          Your membership has insufficient authority for assigning this permission.
        </p>
      }
    />
    <div className="flex items-center">
      <span className="text-fg-default">Default role</span>
      <Popover
        trigger={
          <Button variant="ghost" size="icon-sm" aria-label="About the default role">
            <Info className="size-4" />
          </Button>
        }
        openOnHover
        width="lg"
        content={
          <div className="text-sm font-normal text-fg-default">
            <p>New members will be assigned to this role by default.</p>
          </div>
        }
      />
    </div>
  </div>
));

export const Playground = createPreview({
  controls: controlsFor(Tooltip, {
    trigger: {
      type: 'radio',
      options: ['button', 'icon', 'text'],
      default: 'button',
      derive: kind =>
        kind === 'icon' ? (
          <Button layout="iconOnly" icon={Copy} aria-label="Copy access token" />
        ) : kind === 'text' ? (
          'Sep 10 14:22:07'
        ) : (
          <Button label="Hover me" />
        ),
    },
    content: { type: 'text', default: 'Runs a check against the registry.' },
    side: { type: 'radio', options: ['top', 'right', 'bottom', 'left'], default: 'top' },
    align: { type: 'radio', options: ['start', 'center', 'end'], default: 'center' },
    maxWidth: { type: 'radio', options: ['default', 'md', 'lg', 'screen'], default: 'default' },
    padding: { type: 'radio', options: ['default', 'lg'], default: 'default' },
    arrow: { type: 'boolean', default: false },
    disableHoverablePopup: { type: 'boolean', default: false },
    disabled: { type: 'boolean', default: false },
  }),
  render: v => (
    <div className="p-16">
      <Tooltip
        trigger={v.trigger}
        content={v.content}
        side={v.side}
        align={v.align}
        maxWidth={v.maxWidth}
        padding={v.padding}
        arrow={v.arrow}
        disableHoverablePopup={v.disableHoverablePopup}
        disabled={v.disabled}
      />
    </div>
  ),
});
