import { useEffect, useLayoutEffect, useReducer, useRef, useState } from 'react';
import { useMounted } from '@theguild/components';

export interface MaskingScrollviewProps {
  fade: 'x' | 'y';
  children: React.ReactNode;
  className?: string;
  outerClassName?: string;
}

export function MaskingScrollview({
  fade,
  children,
  className,
  outerClassName,
  ...rest
}: MaskingScrollviewProps) {
  const scrollviewRef = useRef<HTMLDivElement | null>(null);
  const { scrolledSides, shouldTransition } = useScrolledSides(scrollviewRef);

  // We must only calculate the style on the client to avoid a "prop did not match" error.
  const mounted = useMounted();

  return (
    <div
      {...rest}
      className={outerClassName}
      style={
        mounted
          ? {
              // replace "mask" with "background" to debug it
              maskImage:
                fade === 'x'
                  ? scrolledSides.left && scrolledSides.right
                    ? 'none'
                    : `linear-gradient(to left, transparent, black 128px 25%, black 50%, transparent 50%),
               linear-gradient(to right, transparent, black 128px 25%, black 50%, transparent 50%)`
                  : scrolledSides.top && scrolledSides.bottom
                    ? 'none'
                    : `linear-gradient(to bottom, transparent, black 128px 25%, black 50%, transparent 50%),
               linear-gradient(to top, transparent, black 128px 25%, black 50%, transparent 50%)`,
              maskSize:
                fade === 'x'
                  ? 'calc(100% + 128px) 100%, calc(100% + 128px) 100%'
                  : '100% calc(100% + 128px), 100% calc(100% + 128px)',
              maskPosition:
                fade === 'x'
                  ? `${scrolledSides.right ? '0px' : '-128px'} 0%, ${scrolledSides.left ? '0px' : '-128px'} 0%`
                  : `0% ${scrolledSides.top ? '-128px' : '0px'}, 0% ${scrolledSides.bottom ? '0px' : '-128px'}`,
              transition: shouldTransition
                ? 'mask-position 0.5s ease, -webkit-mask-position 0.5s ease'
                : '',
            }
          : {}
      }
    >
      <div ref={scrollviewRef} className={className}>
        {children}
      </div>
    </div>
  );
}

const useClientsideEffect = typeof window === 'undefined' ? () => {} : useLayoutEffect;

export function useScrolledSides(
  scrollviewRef: React.MutableRefObject<HTMLElement | null>,
  options: {
    thresholdPx?: number;
    disabled?: boolean;
  } = {},
) {
  const { thresholdPx = 8, disabled = false } = options;

  const [scrolledSides, setScrolledSides] = useState({
    top: false,
    right: false,
    bottom: false,
    left: false,
  });
  const [transitionsAllowed, allowTransitions] = useReducer(() => true, false);

  useEffect(() => {
    if (disabled) return;

    let timeout: number | undefined;

    const handleScroll = () => {
      const scrollview = scrollviewRef.current;

      if (!scrollview) return;

      const { scrollWidth, clientWidth, scrollLeft, scrollTop, scrollHeight, clientHeight } =
        scrollview;
      const newState = {
        top: scrollTop <= thresholdPx,
        right: scrollLeft >= scrollWidth - clientWidth - thresholdPx,
        bottom: scrollTop >= scrollHeight - clientHeight - thresholdPx,
        left: scrollLeft <= thresholdPx,
      };

      if (JSON.stringify(scrolledSides) !== JSON.stringify(newState)) {
        if (!transitionsAllowed) allowTransitions();
        setScrolledSides(newState);
      }
    };

    const addListener = () => {
      const scrollview = scrollviewRef.current;

      if (scrollview) {
        if (timeout != null) window.clearTimeout(timeout);

        scrollview.addEventListener('scroll', handleScroll, { passive: true });
      } else {
        timeout = window.setTimeout(() => addListener(), 1000);
      }
    };

    addListener();

    return () => {
      const scrollview = scrollviewRef.current;
      if (timeout != null) window.clearTimeout(timeout);
      if (scrollview) scrollview.removeEventListener('scroll', handleScroll);
    };
  }, [scrolledSides, scrollviewRef, thresholdPx, transitionsAllowed, disabled]);

  useClientsideEffect(() => {
    if (disabled) return;

    const scrollview = scrollviewRef.current;
    if (!scrollview) return;

    const child = scrollview.firstElementChild;
    const childWidth = child?.clientWidth || scrollview.clientWidth;
    const childHeight = child?.clientHeight || scrollview.clientHeight;

    const newState = {
      top: scrollview.scrollTop <= thresholdPx,
      right: Math.abs(scrollview.clientWidth - childWidth) < thresholdPx,
      bottom: Math.abs(scrollview.clientHeight - childHeight) < thresholdPx,
      left: scrollview.scrollLeft <= thresholdPx,
    };

    if (JSON.stringify(scrolledSides) !== JSON.stringify(newState)) {
      setScrolledSides(newState);
    }
  }, [scrollviewRef, disabled]);

  return { scrolledSides, shouldTransition: transitionsAllowed };
}
