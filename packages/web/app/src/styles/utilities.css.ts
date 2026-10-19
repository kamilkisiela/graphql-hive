import { style } from '@vanilla-extract/css';
import { utilities } from './layers.css';
import { vars } from './theme.css';

/*
 * The app's own utility classes, ported from the `@utility` and `@layer utilities` blocks of
 * `index.css`. Nothing references these until call sites move off the Tailwind class names.
 */

/** Full width until 2xl, then 1800px, matching the v3-era container config. */
export const container = style({
  '@layer': {
    [utilities]: {
      width: '100%',
      maxWidth: 'none',
      marginInline: 'auto',
      paddingInline: '2rem',
      '@media': {
        '(width >= 96rem)': { maxWidth: 1800 },
      },
    },
  },
});

/**
 * Thin, muted scrollbar. The standard properties cover Firefox, Chromium 121+ and Safari 18.2+;
 * the -webkit- rules cover older Chromium and Safari, which ignore the standard ones. Browsers
 * that support both prefer the standard properties, so the two never fight.
 */
export const thinScrollbar = style({
  '@layer': {
    [utilities]: {
      scrollbarWidth: 'thin',
      scrollbarColor: `${vars.color.neutral[7]} transparent`,
      selectors: {
        '&::-webkit-scrollbar': { width: 8, height: 8 },
        '&::-webkit-scrollbar-track': { background: 'transparent' },
        '&::-webkit-scrollbar-thumb': {
          backgroundColor: vars.color.neutral[7],
          borderRadius: 4,
        },
      },
    },
  },
});

export const noScrollbar = style({
  '@layer': {
    [utilities]: {
      msOverflowStyle: 'none',
      scrollbarWidth: 'none',
      selectors: {
        '&::-webkit-scrollbar': { display: 'none' },
      },
    },
  },
});
