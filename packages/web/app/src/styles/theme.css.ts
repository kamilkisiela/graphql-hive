import { assignVars, createGlobalThemeContract, globalStyle } from '@vanilla-extract/css';
import { base, theme } from './layers.css';

/*
 * Design tokens, ported from the `@theme` and `@layer base` blocks of `index.css`.
 *
 * Two tiers, as before:
 *
 * - `palette` holds the raw values: HSL channel triplets (`0 0% 99%`), the semantic aliases that
 *   point at them (`--surface-page: var(--neutral-3)`), and a few literal colours. Light values
 *   sit on `:root`, dark overrides on `.dark`. The variable names are unchanged, so the
 *   `--hive-laboratory-*` bridge to `@graphql-hive/laboratory` and Foundry's canvas colours keep
 *   reading them.
 * - `vars` is the token layer that styles consume: `--color-*` wraps a channel in `hsl()`, plus
 *   fonts, the two extra text steps, radii and easing. These are Tailwind's theme variable names,
 *   kept so compiled Tailwind utilities and hand-written Vanilla Extract agree on one vocabulary.
 *
 * Animation tokens (`--animate-*`) live with their keyframes in `global.css.ts`.
 */

export const palette = createGlobalThemeContract({
  neutral: {
    1: 'neutral-1',
    2: 'neutral-2',
    3: 'neutral-3',
    4: 'neutral-4',
    5: 'neutral-5',
    6: 'neutral-6',
    7: 'neutral-7',
    8: 'neutral-8',
    9: 'neutral-9',
    10: 'neutral-10',
    11: 'neutral-11',
    12: 'neutral-12',
  },
  accent: 'accent',
  success: 'success',
  info: 'info',
  warning: 'warning',
  critical: 'critical',
  successText: 'success-text',
  infoText: 'info-text',
  warningText: 'warning-text',
  criticalText: 'critical-text',
  chart: {
    1: 'chart-1',
    2: 'chart-2',
    3: 'chart-3',
    4: 'chart-4',
    5: 'chart-5',
    6: 'chart-6',
    grid: 'chart-grid',
  },
  surface: {
    page: 'surface-page',
    card: 'surface-card',
    cardHover: 'surface-card-hover',
    overlay: 'surface-overlay',
    floating: 'surface-floating',
    control: 'surface-control',
    controlRaised: 'surface-control-raised',
    selected: 'surface-selected',
    inverse: 'surface-inverse',
    hover: 'surface-hover',
    pressed: 'surface-pressed',
    inset: 'surface-inset',
    code: 'surface-code',
    skeleton: 'surface-skeleton',
    stripe: 'surface-stripe',
  },
  fg: {
    DEFAULT: 'fg',
    default: 'fg-default',
    secondary: 'fg-secondary',
    muted: 'fg-muted',
    subtle: 'fg-subtle',
    inverse: 'fg-inverse',
  },
  line: {
    DEFAULT: 'line',
    subtle: 'line-subtle',
    strong: 'line-strong',
    control: 'line-control',
  },
  diff: {
    added: 'diff-added',
    addedHover: 'diff-added-hover',
    addedGutter: 'diff-added-gutter',
    removed: 'diff-removed',
    removedHover: 'diff-removed-hover',
    removedGutter: 'diff-removed-gutter',
    removedStrike: 'diff-removed-strike',
  },
  editor: 'editor',
  editorBackdrop: 'editor-backdrop',
  layout: {
    headerHeight: 'header-height',
    tabsNavbarHeight: 'tabs-navbar-height',
    contentHeight: 'content-height',
  },
});

globalStyle(':root', {
  '@layer': {
    [base]: {
      colorScheme: 'light',
      vars: assignVars(palette, {
        neutral: {
          1: '0 0% 99%',
          2: '180 9% 97%',
          3: '210 7% 95%',
          4: '200 6% 92%',
          5: '210 6% 89%',
          6: '204 5% 79%',
          7: '197 4% 67%',
          8: '196 4% 51%',
          9: '193 9% 32%',
          10: '188 15% 21%',
          11: '188 19% 15%',
          12: '175 23% 10%',
        },
        accent: '206 96% 35%',
        success: '130 50% 46%',
        info: '206 96% 35%',
        warning: '40 88% 41%',
        critical: '0 69% 46%',
        // Text on its own tint needs 4.5:1, even over a toned table; the hues above are too light.
        successText: '130 50% 30%',
        infoText: '206 96% 32%',
        warningText: '40 88% 28%',
        criticalText: '0 69% 42%',
        chart: {
          1: '45 93% 47%',
          2: '0 86% 60%',
          3: '160 82% 39%',
          4: '199 89% 48%',
          5: '258 90% 66%',
          6: '330 81% 60%',
          grid: '0 0% 35%',
        },
        surface: {
          page: palette.neutral[3],
          card: palette.neutral[2],
          cardHover: palette.neutral[1],
          overlay: palette.neutral[3],
          floating: palette.neutral[2],
          control: palette.neutral[2],
          controlRaised: palette.neutral[1],
          selected: palette.neutral[5],
          inverse: palette.neutral[12],
          hover: palette.neutral[4],
          pressed: palette.neutral[3],
          inset: palette.neutral[1],
          code: palette.neutral[5],
          skeleton: palette.neutral[5],
          stripe: `hsl(${palette.neutral[2]} / 0.6)`,
        },
        fg: {
          DEFAULT: palette.neutral[12],
          default: palette.neutral[11],
          secondary: palette.neutral[10],
          muted: palette.neutral[9],
          subtle: palette.neutral[8],
          inverse: palette.neutral[1],
        },
        line: {
          DEFAULT: palette.neutral[5],
          subtle: palette.neutral[4],
          strong: palette.neutral[6],
          control: palette.neutral[5],
        },
        diff: {
          added: '#00a77a',
          addedHover: '#008c66',
          addedGutter: 'rgb(0 91 67 / 0.3)',
          removed: '#561c1d',
          removedHover: '#8e1c22',
          removedGutter: 'rgb(116 23 28 / 0.3)',
          removedStrike: '#998c8b',
        },
        editor: `hsl(${palette.neutral[2]})`,
        editorBackdrop: `hsl(${palette.neutral[1]})`,
        layout: {
          headerHeight: '84px',
          tabsNavbarHeight: '47px',
          contentHeight: `calc(100vh - ${palette.layout.headerHeight} - ${palette.layout.tabsNavbarHeight})`,
        },
      }),
    },
  },
});

// Dark only overrides what differs; everything else inherits the light alias, which re-resolves
// against the dark neutrals.
globalStyle('.dark', {
  '@layer': {
    [base]: {
      colorScheme: 'dark',
      vars: {
        [palette.neutral[1]]: '210 21% 5%',
        [palette.neutral[2]]: '210 16% 7%',
        [palette.neutral[3]]: '214 14% 10%',
        [palette.neutral[4]]: '210 13% 13%',
        [palette.neutral[5]]: '210 12% 16%',
        [palette.neutral[6]]: '210 11% 21%',
        [palette.neutral[7]]: '210 12% 27%',
        [palette.neutral[8]]: '210 11% 34%',
        [palette.neutral[9]]: '210 10% 43%',
        [palette.neutral[10]]: '213 9% 58%',
        [palette.neutral[11]]: '210 11% 75%',
        [palette.neutral[12]]: '204 14% 93%',
        [palette.accent]: '48 100% 83%',
        [palette.success]: '129 69% 65%',
        [palette.info]: '203 100% 87%',
        [palette.warning]: '40 96% 61%',
        [palette.critical]: '0 69% 68%',
        [palette.successText]: palette.success,
        [palette.infoText]: palette.info,
        [palette.warningText]: palette.warning,
        [palette.criticalText]: palette.critical,
        [palette.chart[1]]: '45 93% 52%',
        [palette.chart[2]]: '0 86% 65%',
        [palette.chart[3]]: '160 82% 49%',
        [palette.chart[4]]: '199 89% 58%',
        [palette.chart[5]]: '258 90% 72%',
        [palette.chart[6]]: '330 81% 68%',
        [palette.chart.grid]: '0 0% 45%',
        [palette.surface.page]: palette.neutral[2],
        [palette.surface.card]: palette.neutral[3],
        [palette.surface.cardHover]: palette.neutral[4],
        [palette.surface.floating]: palette.neutral[4],
        [palette.surface.control]: palette.neutral[3],
        [palette.surface.controlRaised]: palette.neutral[5],
        [palette.surface.pressed]: palette.neutral[5],
        [palette.surface.inset]: palette.neutral[2],
        [palette.surface.stripe]: `hsl(${palette.neutral[3]} / 0.6)`,
        [palette.line.control]: palette.neutral[4],
        [palette.diff.added]: '#11362b',
        [palette.diff.addedHover]: '#005b43',
        [palette.editor]: '#10151f',
        [palette.editorBackdrop]: '#030711',
      },
    },
  },
});

/** What `@graphql-hive/laboratory` reads to match the app's theme. Not for use in the app. */
const laboratoryBridge = (overrides: Partial<Record<string, string>> = {}) => ({
  '--hive-laboratory-radius': vars.radius.DEFAULT,
  '--hive-laboratory-background': palette.neutral[2],
  '--hive-laboratory-foreground': palette.neutral[11],
  '--hive-laboratory-card': palette.neutral[1],
  '--hive-laboratory-card-foreground': palette.neutral[11],
  '--hive-laboratory-popover': palette.neutral[3],
  '--hive-laboratory-popover-foreground': palette.neutral[11],
  '--hive-laboratory-primary': palette.accent,
  '--hive-laboratory-primary-foreground': palette.neutral[1],
  '--hive-laboratory-secondary': palette.neutral[3],
  '--hive-laboratory-secondary-foreground': palette.neutral[11],
  '--hive-laboratory-muted': palette.neutral[3],
  '--hive-laboratory-muted-foreground': palette.neutral[11],
  '--hive-laboratory-accent': palette.neutral[4],
  '--hive-laboratory-accent-foreground': palette.neutral[11],
  '--hive-laboratory-destructive': palette.critical,
  '--hive-laboratory-border': palette.neutral[5],
  '--hive-laboratory-input': palette.neutral[5],
  '--hive-laboratory-ring': palette.accent,
  ...overrides,
});

const hsl = (channels: string) => `hsl(${channels})`;
const tint = (channels: string, alpha: number) => `hsl(${channels} / ${alpha})`;

/** One status colour's derived family: solid, text, and the tint/line/muted variants. */
const statusFamily = (name: string) => ({
  DEFAULT: `color-${name}`,
  tint: `color-${name}-tint`,
  tintSubtle: `color-${name}-tint-subtle`,
  tintStrong: `color-${name}-tint-strong`,
  line: `color-${name}-line`,
  lineSubtle: `color-${name}-line-subtle`,
  muted: `color-${name}-muted`,
});

export const vars = createGlobalThemeContract({
  font: {
    sans: 'font-sans',
    mono: 'font-mono',
  },
  default: {
    fontFamily: 'default-font-family',
    monoFontFamily: 'default-mono-font-family',
  },
  text: {
    '2xs': 'text-2xs',
    '2xsLineHeight': 'text-2xs--line-height',
    control: 'text-control',
    controlLineHeight: 'text-control--line-height',
  },
  color: {
    transparent: 'color-transparent',
    current: 'color-current',
    inherit: 'color-inherit',
    neutral: {
      1: 'color-neutral-1',
      2: 'color-neutral-2',
      3: 'color-neutral-3',
      4: 'color-neutral-4',
      5: 'color-neutral-5',
      6: 'color-neutral-6',
      7: 'color-neutral-7',
      8: 'color-neutral-8',
      9: 'color-neutral-9',
      10: 'color-neutral-10',
      11: 'color-neutral-11',
      12: 'color-neutral-12',
    },
    accent: statusFamily('accent'),
    success: { ...statusFamily('success'), text: 'color-success-text' },
    info: { ...statusFamily('info'), text: 'color-info-text' },
    warning: { ...statusFamily('warning'), text: 'color-warning-text' },
    critical: { ...statusFamily('critical'), text: 'color-critical-text' },
    surface: {
      page: 'color-surface-page',
      card: 'color-surface-card',
      cardHover: 'color-surface-card-hover',
      overlay: 'color-surface-overlay',
      floating: 'color-surface-floating',
      control: 'color-surface-control',
      controlRaised: 'color-surface-control-raised',
      selected: 'color-surface-selected',
      inverse: 'color-surface-inverse',
      hover: 'color-surface-hover',
      pressed: 'color-surface-pressed',
      inset: 'color-surface-inset',
      code: 'color-surface-code',
      skeleton: 'color-surface-skeleton',
      stripe: 'color-surface-stripe',
    },
    fg: {
      DEFAULT: 'color-fg',
      default: 'color-fg-default',
      secondary: 'color-fg-secondary',
      muted: 'color-fg-muted',
      subtle: 'color-fg-subtle',
      inverse: 'color-fg-inverse',
    },
    line: {
      DEFAULT: 'color-line',
      subtle: 'color-line-subtle',
      strong: 'color-line-strong',
      control: 'color-line-control',
    },
    diff: {
      added: 'color-diff-added',
      addedHover: 'color-diff-added-hover',
      addedGutter: 'color-diff-added-gutter',
      removed: 'color-diff-removed',
      removedHover: 'color-diff-removed-hover',
      removedGutter: 'color-diff-removed-gutter',
      removedStrike: 'color-diff-removed-strike',
    },
    editor: 'color-editor',
    editorBackdrop: 'color-editor-backdrop',
  },
  radius: {
    DEFAULT: 'radius',
    lg: 'radius-lg',
    md: 'radius-md',
    sm: 'radius-sm',
    xs: 'radius-xs',
  },
  ease: {
    authentic: 'ease-authentic',
  },
  minH: {
    content: 'min-h-content',
  },
});

const statusValues = (channels: string) => ({
  DEFAULT: hsl(channels),
  tint: tint(channels, 0.1),
  tintSubtle: tint(channels, 0.08),
  tintStrong: tint(channels, 0.3),
  line: tint(channels, 0.3),
  lineSubtle: tint(channels, 0.1),
  muted: tint(channels, 0.8),
});

globalStyle(':root, :host', {
  '@layer': {
    [theme]: {
      vars: assignVars(vars, {
        font: {
          sans: "'Instrument Sans', ui-sans-serif, system-ui, sans-serif",
          mono: "ui-monospace, 'SFMono-Regular', 'Menlo', 'Monaco', monospace",
        },
        default: {
          fontFamily: vars.font.sans,
          monoFontFamily: vars.font.mono,
        },
        // Two steps Tailwind lacks and the app kept typing by hand: micro text (badges, chips, tick
        // labels) below xs, and UI control text (buttons, inputs, menus) between xs and sm.
        text: {
          '2xs': '0.625rem',
          '2xsLineHeight': 'calc(0.875 / 0.625)',
          control: '0.8125rem',
          controlLineHeight: 'calc(1.125 / 0.8125)',
        },
        color: {
          transparent: 'transparent',
          current: 'currentColor',
          inherit: 'inherit',
          neutral: {
            1: hsl(palette.neutral[1]),
            2: hsl(palette.neutral[2]),
            3: hsl(palette.neutral[3]),
            4: hsl(palette.neutral[4]),
            5: hsl(palette.neutral[5]),
            6: hsl(palette.neutral[6]),
            7: hsl(palette.neutral[7]),
            8: hsl(palette.neutral[8]),
            9: hsl(palette.neutral[9]),
            10: hsl(palette.neutral[10]),
            11: hsl(palette.neutral[11]),
            12: hsl(palette.neutral[12]),
          },
          accent: statusValues(palette.accent),
          success: { ...statusValues(palette.success), text: hsl(palette.successText) },
          info: { ...statusValues(palette.info), text: hsl(palette.infoText) },
          warning: { ...statusValues(palette.warning), text: hsl(palette.warningText) },
          critical: { ...statusValues(palette.critical), text: hsl(palette.criticalText) },
          surface: {
            page: hsl(palette.surface.page),
            card: hsl(palette.surface.card),
            cardHover: hsl(palette.surface.cardHover),
            overlay: hsl(palette.surface.overlay),
            floating: hsl(palette.surface.floating),
            control: hsl(palette.surface.control),
            controlRaised: hsl(palette.surface.controlRaised),
            selected: hsl(palette.surface.selected),
            inverse: hsl(palette.surface.inverse),
            hover: hsl(palette.surface.hover),
            pressed: hsl(palette.surface.pressed),
            inset: hsl(palette.surface.inset),
            code: hsl(palette.surface.code),
            skeleton: hsl(palette.surface.skeleton),
            stripe: palette.surface.stripe,
          },
          fg: {
            DEFAULT: hsl(palette.fg.DEFAULT),
            default: hsl(palette.fg.default),
            secondary: hsl(palette.fg.secondary),
            muted: hsl(palette.fg.muted),
            subtle: hsl(palette.fg.subtle),
            inverse: hsl(palette.fg.inverse),
          },
          line: {
            DEFAULT: hsl(palette.line.DEFAULT),
            subtle: hsl(palette.line.subtle),
            strong: hsl(palette.line.strong),
            control: hsl(palette.line.control),
          },
          diff: {
            added: palette.diff.added,
            addedHover: palette.diff.addedHover,
            addedGutter: palette.diff.addedGutter,
            removed: palette.diff.removed,
            removedHover: palette.diff.removedHover,
            removedGutter: palette.diff.removedGutter,
            removedStrike: palette.diff.removedStrike,
          },
          editor: palette.editor,
          editorBackdrop: palette.editorBackdrop,
        },
        radius: {
          DEFAULT: '0.5rem',
          lg: vars.radius.DEFAULT,
          md: `calc(${vars.radius.DEFAULT} - 2px)`,
          sm: `calc(${vars.radius.DEFAULT} - 4px)`,
          xs: `calc(${vars.radius.DEFAULT} - 6px)`,
        },
        ease: {
          authentic: 'cubic-bezier(0.4, 0, 0.2, 1)',
        },
        minH: {
          content: palette.layout.contentHeight,
        },
      }),
    },
  },
});

globalStyle(':root', { '@layer': { [base]: { vars: laboratoryBridge() } } });
globalStyle('.dark', {
  '@layer': {
    [base]: {
      vars: laboratoryBridge({
        '--hive-laboratory-background': palette.neutral[1],
        '--hive-laboratory-card': palette.neutral[2],
        '--hive-laboratory-accent': palette.neutral[6],
      }),
    },
  },
});
