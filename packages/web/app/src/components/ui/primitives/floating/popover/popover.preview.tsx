import { useRef, useState } from 'react';
import { Info } from 'lucide-react';
import { controlsFor, createPreview, type NavPath } from 'react-foundry';
import { TagSuggestions } from '@/components/target/settings/contract-form';
import { cn } from '@/lib/utils';
import { Button } from '../../button/button';
import { Input } from '../../input/input';
import { floatingVariants } from '../shared-styles';
import { Popover } from './popover';

export const nav: NavPath = 'Primitives/Floating/Popover';

/** Structured mode: pass `title` and the header with close button is rendered for you. */
export const Structured = createPreview(() => (
  <Popover
    trigger={<Button label="Alert details" />}
    title="Alert details"
    description="Configure the threshold and notification settings."
    content={
      <div className="space-y-2 text-sm">
        <div className="text-fg-default">
          Status: <span className="text-success">Normal</span>
        </div>
        <div className="text-fg-default">Last evaluated: 2 minutes ago</div>
      </div>
    }
  />
));

/** Raw mode: no `title`, so content is rendered directly with no header. Padded by default. */
export const Raw = createPreview(() => (
  <Popover
    trigger={<Button label="Info" />}
    content={<p className="text-sm text-fg-default">A raw popover with custom content.</p>}
  />
));

/**
 * `padding="none"` for content that lays itself out edge to edge: a list of rows, a calendar,
 * a panel with its own header rule.
 */
export const RawPadding = createPreview(() => (
  <div className="flex items-center gap-4">
    <Popover
      trigger={<Button label="Default padding" />}
      content={<p className="text-sm text-fg-default">p-4 around the content.</p>}
    />
    <Popover
      trigger={<Button label="No padding" />}
      padding="none"
      content={
        <ul className="text-sm text-fg-default">
          {['getUser', 'listProjects', 'createTarget'].map(op => (
            <li key={op} className="border-b border-line px-3 py-2 last:border-b-0">
              {op}
            </li>
          ))}
        </ul>
      }
    />
  </div>
));

export const WithArrow = createPreview(() => (
  <Popover
    trigger={<Button label="With arrow" />}
    title="Tooltip-style"
    content={<p className="text-sm text-fg-default">Arrows point back at the trigger.</p>}
    arrow
  />
));

/**
 * One scale for both modes. Raw defaults to `sm`, structured to `md`. `lg` and `xl` are the two widest panels in the app, rounded to the rem grid.
 */
export const Widths = createPreview(() => (
  <div className="flex flex-wrap items-center gap-4">
    <Popover
      trigger={<Button label="auto" />}
      width="auto"
      content={<p className="text-sm text-fg-default">Sizes to content.</p>}
    />
    <Popover
      trigger={<Button label="sm" />}
      width="sm"
      content={<p className="text-sm text-fg-default">w-72, 288px. The raw default.</p>}
    />
    <Popover
      trigger={<Button label="md" />}
      width="md"
      content={<p className="text-sm text-fg-default">w-80, 320px. The structured default.</p>}
    />
    <Popover
      trigger={<Button label="lg" />}
      width="lg"
      content={<p className="text-sm text-fg-default">28rem, 448px. Was 450.</p>}
    />
    <Popover
      trigger={<Button label="xl" />}
      width="xl"
      content={<p className="text-sm text-fg-default">34rem, 544px. Was 550.</p>}
    />
  </div>
));

export const Sides = createPreview(() => (
  <div className="flex items-center gap-4">
    <Popover
      trigger={<Button label="Top" />}
      side="top"
      content={<p className="text-sm text-fg-default">side=&quot;top&quot;</p>}
    />
    <Popover
      trigger={<Button label="Right" />}
      side="right"
      content={<p className="text-sm text-fg-default">side=&quot;right&quot;</p>}
    />
    <Popover
      trigger={<Button label="Bottom" />}
      side="bottom"
      content={<p className="text-sm text-fg-default">side=&quot;bottom&quot;</p>}
    />
    <Popover
      trigger={<Button label="Left" />}
      side="left"
      content={<p className="text-sm text-fg-default">side=&quot;left&quot;</p>}
    />
  </div>
));

/**
 * The close button works uncontrolled now: it is a Base UI `Close` rather than a call to an
 * `onOpenChange` the call site may not have passed.
 */
export const NoCloseButton = createPreview(() => (
  <div className="flex items-center gap-4">
    <Popover
      trigger={<Button label="With close button" />}
      title="Uncontrolled"
      content={<p className="text-sm text-fg-default">The X closes this.</p>}
    />
    <Popover
      trigger={<Button label="No close button" />}
      title="Read only"
      hideCloseButton
      content={<p className="text-sm text-fg-default">Dismiss by clicking outside.</p>}
    />
  </div>
));

/**
 * `anchor` positions the popup against an element that is not its trigger. The date-range
 * picker's shape: a calendar opened from a button inside a field, but placed beside the whole
 * panel the field is in. No `trigger` at all; the call site controls `open`.
 */
export const AnchoredToSibling = createPreview(() => {
  const [open, setOpen] = useState(false);
  const panel = useRef<HTMLDivElement>(null);
  return (
    <div
      ref={panel}
      className={cn(floatingVariants({ padding: 'md' }), 'flex w-72 flex-col gap-3 p-4')}
    >
      <span className="text-xs text-fg-default">A panel with a field in it</span>
      <div className="flex items-center gap-2">
        <Input value="2026-09-01" readOnly />
        <Button label="Pick" onClick={() => setOpen(o => !o)} />
      </div>
      <Popover
        open={open}
        onOpenChange={setOpen}
        anchor={panel}
        side="left"
        sideOffset={4}
        collisionPadding={8}
        width="auto"
        content={
          <p className="text-sm text-fg-default">
            Positioned against the panel, not the Pick button.
          </p>
        }
      />
    </div>
  );
});

// The contract form's tag field: the Input is the `anchor`, not the trigger, and
// `initialFocus={false}` keeps the caret in the field while the suggestions are open.
export const InputAnchor = createPreview(() => {
  const [draft, setDraft] = useState('');
  const [selected, setSelected] = useState(['public']);
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  return (
    <div className="w-64">
      <Input
        ref={inputRef}
        placeholder="Add a tag"
        autoComplete="off"
        value={draft}
        onChange={e => setDraft(e.target.value)}
        onFocus={() => setOpen(true)}
        onClick={() => setOpen(true)}
      />
      <Popover
        open={open}
        onOpenChange={setOpen}
        anchor={inputRef}
        align="start"
        initialFocus={false}
        padding="none"
        width="auto"
        content={
          <TagSuggestions
            tags={['public', 'internal', 'deprecated', 'beta']}
            selected={selected}
            onToggle={tag =>
              setSelected(prev =>
                prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag],
              )
            }
          />
        }
      />
    </div>
  );
});

/**
 * `openOnHover` for an infotip: an icon whose only job is to open the explanation. Hover opens
 * it after the tooltip delay, click toggles it, so it is reachable by keyboard and touch too.
 * Base UI's rule: if the trigger exists to open the popup, it is a popover, not a tooltip.
 */
export const Infotip = createPreview(() => (
  <div className="flex items-center gap-2">
    <span className="text-sm text-fg-default">Resolution count</span>
    <Popover
      trigger={
        <button
          type="button"
          aria-label="What resolution count means"
          className="text-fg-secondary"
        >
          <Info className="size-4" />
        </button>
      }
      openOnHover
      content={
        <p className="text-sm text-fg-default">
          The number of times this field was executed. A single request can resolve a field many
          times, or skip it entirely.
        </p>
      }
    />
  </div>
));

/** `modal` blocks the page behind the popup. For a panel that is a task, not a glance. */
export const Modal = createPreview(() => (
  <div className="flex items-center gap-4">
    <Popover
      trigger={<Button label="Modal" />}
      modal
      title="Pick a range"
      content={
        <p className="text-sm text-fg-default">
          Try clicking the other button while this is open: it does nothing until you close this.
        </p>
      }
    />
    <Button variant="outline">Another button</Button>
  </div>
));

export const Playground = createPreview({
  controls: controlsFor(Popover, {
    trigger: {
      type: 'radio',
      options: ['button', 'icon'],
      default: 'button',
      derive: kind =>
        kind === 'icon' ? (
          <button
            type="button"
            aria-label="What resolution count means"
            className="text-fg-secondary"
          >
            <Info className="size-4" />
          </button>
        ) : (
          <Button label="Alert details" />
        ),
    },
    // Empty leaves the popover in raw mode: no header, so no close button either.
    title: { type: 'text', default: 'Alert details', derive: text => text || undefined },
    description: { type: 'text', default: 'Configure the threshold and notification settings.' },
    content: {
      type: 'text',
      default: 'Status: Normal. Last evaluated 2 minutes ago.',
      derive: text => <p className="text-sm text-fg-default">{text}</p>,
    },
    hideCloseButton: { type: 'boolean', default: false },
    padding: { type: 'radio', options: ['default', 'none'], default: 'default' },
    // Unset falls back per mode: `sm` raw, `md` structured.
    width: {
      type: 'radio',
      options: ['unset', 'auto', 'sm', 'md', 'lg', 'xl'],
      default: 'unset',
      derive: step => (step === 'unset' ? undefined : step),
    },
    side: { type: 'radio', options: ['bottom', 'top', 'left', 'right'], default: 'bottom' },
    align: { type: 'radio', options: ['center', 'start', 'end'], default: 'center' },
    arrow: { type: 'boolean', default: false },
    modal: { type: 'boolean', default: false },
    openOnHover: { type: 'boolean', default: false },
  }),
  render: v => {
    const shared = {
      trigger: v.trigger,
      width: v.width,
      side: v.side,
      align: v.align,
      arrow: v.arrow,
      modal: v.modal,
      openOnHover: v.openOnHover,
    };
    // `title` is the discriminant: with one the header renders and `padding` is not a prop.
    return v.title === undefined ? (
      <Popover {...shared} content={v.content} padding={v.padding} />
    ) : (
      <Popover
        {...shared}
        title={v.title}
        description={v.description}
        content={v.content}
        hideCloseButton={v.hideCloseButton}
      />
    );
  },
});
