import { forwardRef, type ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { ScrollArea as BaseScrollArea } from '@base-ui/react/scroll-area';
import * as styles from './scroll-area.css';

const heightClass = {
  sm: styles.heightClassSm,
  md: styles.heightClassMd,
  lg: styles.heightClassLg,
} as const;

const maxHeightClass = {
  sm: styles.maxHeightClassSm,
  md: styles.maxHeightClassMd,
  lg: styles.maxHeightClassLg,
  screen: styles.maxHeightClassScreen,
} as const;

const viewportOverflowClass = {
  vertical: styles.viewportOverflowClassVertical,
  horizontal: styles.viewportOverflowClassHorizontal,
  both: styles.viewportOverflowClassBoth,
} as const;

// Overlaid, and only drawn while the pointer is over the area or it is scrolling. Base UI sets
// `position: absolute` itself; the placement classes below say which edge.
const scrollbarClass = [
  'flex touch-none select-none rounded-full',
  'opacity-0 transition-opacity delay-300 duration-200',
  'data-[hovering]:opacity-100 data-[hovering]:delay-0 data-[hovering]:duration-100',
  'data-[scrolling]:opacity-100 data-[scrolling]:delay-0 data-[scrolling]:duration-100',
  'hover:opacity-100 hover:delay-0',
].join(' ');

const thumbClass = styles.thumbClass;

type ScrollAreaProps = {
  children: ReactNode;
  /** Which way the content can overflow. The other axis is clipped. */
  axis?: keyof typeof viewportOverflowClass;
  height?: keyof typeof heightClass;
  /** Scroll only once the content is taller than this. */
  maxHeight?: keyof typeof maxHeightClass;
  /** Take the remaining height of a flex column, for a panel that fills what is left of a page or a card. */
  fill?: boolean;
  'data-cy'?: string;
};

/**
 * The ref lands on the scrolling element, for code that reads or sets the scroll position (a
 * log pane that follows its tail).
 */
export const ScrollArea = forwardRef<HTMLDivElement, ScrollAreaProps>(function ScrollArea(
  { children, axis = 'vertical', height, maxHeight, fill, 'data-cy': dataCy },
  ref,
) {
  return (
    <BaseScrollArea.Root
      data-cy={dataCy}
      // A flex column so a max-height on the root constrains the viewport, which a percentage
      // height on the viewport would not. `contain-inline-size` stops the content's width from
      // counting as the area's own: a grid or flex parent sizing its track to min-content would
      // otherwise grow to the longest unbreakable row and push past its neighbours.
      className={cn(
        styles.scrollAreaRoot,
        'group/scroll-area',
        height && heightClass[height],
        maxHeight && maxHeightClass[maxHeight],
        fill && styles.scrollAreaRoot2,
      )}
    >
      <BaseScrollArea.Viewport
        ref={ref}
        // The scrollbar is overlaid, so the viewport gives up the same gutter a native one would
        // take, but only once there is something to scroll, so short content sits flush.
        className={cn(
          styles.scrollAreaViewport,
          styles.scrollAreaViewport2,
          viewportOverflowClass[axis],
        )}
      >
        {/*
          Content sets an inline `min-width: fit-content`, which a wide table needs to get room to
          scroll into. On a vertical-only area it also stops a row of unbreakable text from ever
          truncating, and the list pushes its whole grid column wider instead.
        */}
        {axis === 'vertical' ? (
          children
        ) : (
          <BaseScrollArea.Content>{children}</BaseScrollArea.Content>
        )}
      </BaseScrollArea.Viewport>
      {axis !== 'horizontal' ? (
        <BaseScrollArea.Scrollbar
          orientation="vertical"
          className={cn(scrollbarClass, styles.scrollAreaScrollbar)}
        >
          <BaseScrollArea.Thumb className={cn(thumbClass, styles.scrollAreaThumb)} />
        </BaseScrollArea.Scrollbar>
      ) : null}
      {axis !== 'vertical' ? (
        <BaseScrollArea.Scrollbar
          orientation="horizontal"
          className={cn(scrollbarClass, styles.scrollAreaScrollbar2)}
        >
          <BaseScrollArea.Thumb className={cn(thumbClass, styles.scrollAreaThumb2)} />
        </BaseScrollArea.Scrollbar>
      ) : null}
      {axis === 'both' ? <BaseScrollArea.Corner /> : null}
    </BaseScrollArea.Root>
  );
});
