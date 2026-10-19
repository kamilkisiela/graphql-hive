import svgToDataUri from 'mini-svg-data-uri';
import { style } from '@vanilla-extract/css';
import { utilities } from './layers.css';
import { palette } from './theme.css';

/*
 * Background patterns, ported from the `bg-grid-*`, `bg-grid-small-*` and `bg-dot-*` utilities
 * of `src/lib/tailwind-plugins.js`. The Tailwind plugin accepted any theme colour; styles here
 * are built ahead of time, so each colour that is used gets a named variant. Adding one is one
 * line. The colour is the theme's `hsl(var(--x))` form, exactly as the plugin received it.
 */

const pattern = (svg: string) =>
  style({
    '@layer': {
      [utilities]: { backgroundImage: `url("${svgToDataUri(svg)}")` },
    },
  });

const grid = (stroke: string) =>
  pattern(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="32" height="32" fill="none" stroke="${stroke}"><path d="M0 .5H31.5V32"/></svg>`,
  );

const gridSmall = (stroke: string) =>
  pattern(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="8" height="8" fill="none" stroke="${stroke}"><path d="M0 .5H31.5V32"/></svg>`,
  );

const dot = (fill: string) =>
  pattern(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="16" height="16" fill="none"><circle fill="${fill}" id="pattern-circle" cx="10" cy="10" r="1.6257413380501518"></circle></svg>`,
  );

export const bgDot = {
  lineStrong: dot(`hsl(${palette.line.strong})`),
};

export const bgGrid = {
  neutral5: grid(`hsl(${palette.neutral[5]})`),
};

export const bgGridSmall = {
  neutral5: gridSmall(`hsl(${palette.neutral[5]})`),
};
