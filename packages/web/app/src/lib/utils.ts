import { useLayoutEffect, useState } from 'react';
import { clsx, type ClassValue } from 'clsx';
import { extendTailwindMerge } from 'tailwind-merge';
import { useTheme } from '@/components/theme/theme-provider';

// tailwind-merge only knows the stock font sizes. Without this it reads `text-control` as a
// colour and drops the real colour merged next to it (`text-fg text-control`).
const twMerge = extendTailwindMerge({
  extend: { classGroups: { 'font-size': [{ text: ['control'] }] } },
});

// Style-related
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Convert HSL values (h in degrees, s and l in percent) to a hex string. */
function hslToHex(h: number, s: number, l: number): string {
  s /= 100;
  l /= 100;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    return Math.round(255 * color)
      .toString(16)
      .padStart(2, '0');
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}

export function stringToHiveColor(str: string): string {
  let hash = 0;

  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
    hash = hash & hash;
  }
  const hue = Math.abs(hash) % 360;
  const saturation = 75;
  const lightness = 65;

  return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
}

// Canvas charts, iframes and other widgets can't read CSS variables, so they get concrete colors.
// Hex rather than hsl(): ECharts can't parse comma-less HSL like hsl(45 93% 47%).
function cssVarHex(s: CSSStyleDeclaration, name: string) {
  const raw = s.getPropertyValue(name).trim();
  if (!raw) return '#888';
  const [h, sVal, l] = raw.split(' ').map(v => parseFloat(v));
  return hslToHex(h, sVal, l);
}

function cssVarRgba(s: CSSStyleDeclaration, name: string, alpha: number) {
  const raw = s.getPropertyValue(name).trim();
  if (!raw) return `rgba(128,128,128,${alpha})`;
  const hexColor = cssVarHex(s, name);
  const r = parseInt(hexColor.slice(1, 3), 16);
  const g = parseInt(hexColor.slice(3, 5), 16);
  const b = parseInt(hexColor.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

function readResolvedColors() {
  const s = getComputedStyle(document.documentElement);
  return {
    fg: cssVarHex(s, '--fg'),
    fgMuted: cssVarHex(s, '--fg-muted'),
    critical: cssVarHex(s, '--critical'),
    warning: cssVarHex(s, '--warning'),
    info: cssVarHex(s, '--info'),
    success: cssVarHex(s, '--success'),
  };
}

function readChartStyles() {
  const s = getComputedStyle(document.documentElement);

  return {
    colors: {
      ...readResolvedColors(),
      primary: cssVarHex(s, '--chart-1'),
      /** Area fill gradient for a primary series, top and bottom. */
      primaryAreaFrom: cssVarRgba(s, '--chart-1', 0.2),
      primaryAreaTo: cssVarRgba(s, '--chart-1', 0),
      error: cssVarHex(s, '--chart-2'),
      p75: cssVarHex(s, '--chart-3'),
      p90: cssVarHex(s, '--chart-4'),
      p95: cssVarHex(s, '--chart-5'),
      p99: cssVarHex(s, '--chart-6'),
      grid: cssVarHex(s, '--chart-grid'),
      /** Semi-transparent text color overlay — for label pills on colored surfaces. */
      overlayBg: cssVarRgba(s, '--neutral-12', 0.7),
      /** Page-background color — for text on overlayBg pills. */
      overlayText: cssVarHex(s, '--neutral-1'),
      /** Semi-transparent text color — for subtle borders on colored surfaces. */
      overlayBorder: cssVarRgba(s, '--neutral-12', 0.2),
      /** Muted axis label color. */
      axisLabel: cssVarHex(s, '--neutral-10'),
      /** Subtle grid line color. */
      gridSubtle: cssVarHex(s, '--neutral-6'),
      /** Line color for single-series charts. */
      line: cssVarHex(s, '--neutral-9'),
      /** Area fill gradient top (neutral-1). */
      areaFillFrom: cssVarHex(s, '--neutral-1'),
      /** Area fill gradient bottom (neutral-4). */
      areaFillTo: cssVarHex(s, '--neutral-4'),
    },
  };
}

/** Re-reads after the theme class lands on <html>, one frame after the theme changes. */
function useThemeRead<T>(read: () => T): T {
  const { resolvedTheme } = useTheme();
  const [value, setValue] = useState(read);

  useLayoutEffect(() => {
    const rafId = requestAnimationFrame(() => {
      setValue(read());
    });
    return () => cancelAnimationFrame(rafId);
  }, [read, resolvedTheme]);

  return value;
}

/** Theme colors as hex, for widgets outside CSS such as Stripe's card iframe. */
export function useResolvedColors() {
  return useThemeRead(readResolvedColors);
}

/** ECharts options and colors, including the resolved theme colors. */
export function useChartStyles() {
  return useThemeRead(readChartStyles);
}

// Strings
/** "2 errors", "1 breaking change"; `label` replaces the number, for "10+ operations". */
export function formatCount(count: number, noun: string, label = String(count)) {
  return `${label} ${pluralize(count, noun, `${noun}s`)}`;
}

export function pluralize(count: number, singular: string, plural: string): string {
  if (count === 1) {
    return singular;
  }

  return plural;
}

export function capitalize(str: string) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

// Errors
export function exhaustiveGuard(_value: never): never {
  throw new Error(
    `Reached forbidden guard function with unexpected value: ${JSON.stringify(_value)}`,
  );
}

type Truthy<T> = T extends false | '' | 0 | null | undefined ? never : T; // from lodash

export function truthy<T>(value: T): value is Truthy<T> {
  return !!value;
}
