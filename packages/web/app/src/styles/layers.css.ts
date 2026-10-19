import { globalLayer } from '@vanilla-extract/css';

/**
 * Cascade layers, declared once and first.
 *
 * The names and order are Tailwind v4's own (`@layer properties, theme, base, components,
 * utilities`). While both systems coexist, styles written here merge into the same layers as the
 * utilities they sit next to, so a Tailwind utility on a call site still overrides a component's
 * Vanilla Extract base style exactly as `cn(base, className)` did. Once Tailwind is gone this file
 * is what keeps the order.
 *
 * This module must be imported before any other stylesheet (see `src/styles/index.ts`): the first
 * `@layer` statement the browser sees fixes the order for everyone.
 */
export const properties = globalLayer('properties');
export const theme = globalLayer('theme');
export const base = globalLayer('base');
export const components = globalLayer('components');
export const utilities = globalLayer('utilities');
