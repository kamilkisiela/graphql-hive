import { globalStyle, keyframes } from '@vanilla-extract/css';
import { base, components } from './layers.css';
import { vars } from './theme.css';

/*
 * Element-level rules, ported from the `@layer base` and `@layer components` blocks of
 * `index.css`. Classes that TSX still names as strings (`hive-markdown`, `hive-loading-indicator`,
 * `hive-badge-is-changed`) keep their names here; they become exported styles when their call
 * sites move.
 *
 * Not ported, because nothing in the app uses them any more: `.hive-modal` and its keyframes,
 * the `.schema-doc-row-*` counters, and the shadcn `animate-in` family (the laboratory package
 * carries its own copy).
 */

// Base ---------------------------------------------------------------------------------------

// Tailwind v3-era ring and shadow defaults that the ring utilities still read.
globalStyle('*', {
  '@layer': {
    [base]: {
      vars: {
        '--tw-ring-inset': ' ',
        '--tw-ring-offset-width': '1px',
        '--tw-ring-offset-color': vars.color.accent.line,
        '--tw-ring-offset-shadow': '0 0 #0000',
        '--tw-ring-shadow': '0 0 #0000',
        '--tw-shadow': '0 0 #0000',
        '--tw-shadow-colored': '0 0 #0000',
      },
    },
  },
});

globalStyle(':root', {
  '@layer': {
    [base]: {
      fontFamily: vars.font.sans,
      WebkitFontSmoothing: 'auto',
      MozOsxFontSmoothing: 'auto',
    },
  },
});

globalStyle('*', {
  '@layer': { [base]: { borderColor: vars.color.line.DEFAULT } },
});

globalStyle('#root, body', {
  '@layer': {
    [base]: {
      backgroundColor: vars.color.surface.page,
      color: vars.color.fg.default,
    },
  },
});

globalStyle("button, [role='button']", {
  '@layer': { [base]: { cursor: 'pointer' } },
});

globalStyle(':disabled', {
  '@layer': { [base]: { cursor: 'default' } },
});

globalStyle('::placeholder', {
  '@layer': { [base]: { color: vars.color.fg.muted } },
});

// Components ---------------------------------------------------------------------------------

// No !important: the utilities layer sits above this one, so a component's own focus-visible
// outline wins, while anything without one stays outline-free.
globalStyle('*:active, *:focus', {
  '@layer': { [components]: { outline: 'none' } },
});

globalStyle('#root', {
  '@layer': {
    [components]: {
      display: 'flex',
      height: '100%',
      flexDirection: 'column',
      fontSize: vars.text.sm,
      lineHeight: `var(--tw-leading, ${vars.text.smLineHeight})`,
      WebkitFontSmoothing: 'antialiased',
      MozOsxFontSmoothing: 'grayscale',
    },
  },
});

// Remove autocomplete color in Chrome.
globalStyle(
  'input:-webkit-autofill, input:-webkit-autofill:hover, input:-webkit-autofill:focus, input:-webkit-autofill:active',
  {
    '@layer': {
      [components]: {
        WebkitTransition: 'color 9999s ease-out, background-color 9999s ease-out',
        WebkitTransitionDelay: '9999s',
      },
    },
  },
);

// Remove the default arrow on the right.
globalStyle('select', {
  '@layer': { [components]: { appearance: 'none' } },
});

// Scoped to the editor: Base UI's tab indicator is a presentation role too.
globalStyle(".monaco-editor, .monaco-editor-background, .monaco-editor [role='presentation']", {
  '@layer': {
    [components]: {
      background: 'transparent !important',
      vars: { '--vscode-focusBorder': 'transparent !important' },
    },
  },
});

globalStyle('.hive-markdown a', {
  '@layer': { [components]: { color: vars.color.accent.DEFAULT } },
});

globalStyle('.hive-markdown a:hover', {
  '@layer': {
    [components]: {
      '@media': { '(hover: hover)': { textDecorationLine: 'none' } },
    },
  },
});

globalStyle('.hive-markdown code', {
  '@layer': {
    [components]: {
      borderRadius: vars.radius.sm,
      backgroundColor: vars.color.neutral[2],
      paddingInline: `calc(${vars.spacing} * 2)`,
      paddingBlock: vars.spacing,
      color: vars.color.accent.DEFAULT,
    },
  },
});

const loadingIndicator = keyframes({
  '0%': { left: '-40%' },
  '100%': { left: '100%' },
});

globalStyle('.hive-loading-indicator', {
  '@layer': {
    [components]: {
      background: `linear-gradient(to right, transparent 0%, ${vars.color.accent.DEFAULT} 50%, transparent 100%)`,
      animation: `1s ease 0s infinite normal none running ${loadingIndicator}`,
    },
  },
});

// Hide the arrows on <input type="number" />.
globalStyle('input::-webkit-inner-spin-button', {
  '@layer': { [components]: { WebkitAppearance: 'none' } },
});

// Unlayered, as the original was: a plain class rule outside every layer. ------------------

globalStyle('.hive-badge-is-changed:after', {
  position: 'absolute',
  right: `calc(${vars.spacing} * 2)`,
  width: `calc(${vars.spacing} * 1.5)`,
  height: `calc(${vars.spacing} * 1.5)`,
  borderRadius: 'calc(infinity * 1px)',
  borderStyle: 'solid',
  borderWidth: 1,
  borderBottomColor: vars.color.accent.DEFAULT,
  backgroundColor: vars.color.accent.muted,
  content: "''",
});
