import * as styles from './shared-styles.css';

/**
 * Shared style tokens for base components (button segments, disabled state, etc.)
 *
 * Floating-specific styles (floating panel, items, scroll areas) live in
 * `./floating/shared-styles.ts`.
 */

/** Separator between segments in a segmented trigger (label | icon, label | count | ×). */
export const segmentSeparator = styles.segmentSeparator;

/** Interactive segment within a segmented trigger (clickable text area). */
export const segmentButton = styles.segmentButton;

export const disabledStyle = { opacity: 0.5, pointerEvents: 'none' } as const;

/**
 * Keyboard focus for every control: a 2px accent outline, 2px off the edge, on `:focus-visible`
 * only. An outline rather than a box-shadow ring because it needs no offset colour, so it reads
 * the same on the page, on a card and inside a popover.
 */
export const focusRing = styles.focusRing;

/**
 * The quiet ring for text on the page rather than a control with an edge: tabs and navigation
 * links. 1px dotted. The outline follows the element's own radius, which stays with the element:
 * a radius here would also round a border the element draws, like a nav link's underline.
 */
export const focusRingQuiet = styles.focusRingQuiet;

/**
 * Vertical scroll container with a thin, muted scrollbar. Use anywhere content can overflow
 * (sheets, dialogs, floating lists). `thin-scrollbar` is a utility in `index.css` rather than
 * arbitrary Tailwind properties, because older Chromium and Safari need `::-webkit-scrollbar`
 * pseudo-elements that a class string cannot express.
 */
export const scrollArea = styles.scrollArea;

/**
 * The surface a control sits on. `base` is the page background; `raised` is a card or a floating
 * panel. A control is one step lighter than whatever it sits on, so on a raised surface its fill
 * moves up the scale with it.
 *
 * Shared so every control names this the same way. The values differ per component, because a
 * button and a card on the same surface do not want the same classes; this is the vocabulary,
 * and `controlOnSurface` is the ladder for interactive controls specifically.
 */
export type OnSurface = 'base' | 'raised';

// Each entry is the complete fill and border for its surface, at rest and on hover, so the two
// never share a class and neither has to out-order the other. The border stays one step above
// the fill, because the separator inside a segmented control inherits the border color and would
// vanish into a fill of the same shade.
//
// Dark `raised` is `base` shifted +2: a card sits at 3 and a floating panel at 4, and 5 clears
// both. Light has no room above neutral-1, so a raised control rests there and hover moves the
// border instead of the fill.
//
// `controlSurface` is the resting half on its own, for a control whose hover belongs to the
// segments inside it (a toggle group) rather than to the whole.
export const controlSurface = {
  base: styles.controlSurfaceBase,
  raised: styles.controlSurfaceRaised,
} as const satisfies Record<OnSurface, string>;

export const controlOnSurface = {
  base: [
    controlSurface.base,
    'hover:bg-neutral-1 dark:hover:bg-neutral-4 dark:hover:border-line',
  ].join(' '),
  raised: [
    controlSurface.raised,
    'hover:border-line-strong dark:hover:bg-neutral-6 dark:hover:border-neutral-7',
  ].join(' '),
} as const satisfies Record<OnSurface, string>;

/**
 * The two heights an interactive control comes in. `default` (36px) is a form control: an input,
 * a select, a button that submits or navigates. `compact` (30px) is filter chrome: the chips and
 * pickers in a toolbar above a table or chart, which sit in a dense row and read as one strip.
 *
 * Height and font size travel together so a control cannot be tall with small text or the other
 * way round. Padding does not, because it depends on what is inside the control (a segmented
 * trigger pads each segment; a plain button pads itself).
 */
export type ControlSize = 'compact' | 'default';

export const controlSize = {
  compact: styles.controlSizeCompact,
  default: styles.controlSizeDefault,
} as const satisfies Record<ControlSize, string>;
