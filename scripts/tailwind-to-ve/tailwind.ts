/**
 * Compiles every Tailwind class the app uses, once, with Tailwind's own compiler, and indexes
 * the result by class. Each class maps to the rule Tailwind emitted for it and to its position in
 * Tailwind's output, which is the cascade order the app renders with today.
 */
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import postcss, { type AtRule, type Declaration, type Rule } from 'postcss';

export type Query = { kind: '@media' | '@supports' | '@container'; params: string };

/** One rule Tailwind emitted for a class: its selector with the class replaced by `&`. */
export type Entry = {
  /** `&`, `&:hover`, `& svg`, `:where(& > :not(:last-child))`, … */
  selector: string;
  queries: Query[];
  rule: Rule;
  /** Position in Tailwind's output. Lower wins ties later, as in a real stylesheet. */
  order: number;
};

export type CompiledToken = { token: string; entries: Entry[] };

export type Compiled = {
  tokens: Map<string, CompiledToken>;
  /** `--name: value` pairs from the `@layer theme` block Tailwind emitted for these tokens. */
  themeVars: Map<string, string>;
  /** `@property` registrations, keyframes and the `@layer properties` fallbacks, as CSS text. */
  globals: string[];
};

type TailwindNode = {
  compile(
    css: string,
    options: { base: string; onDependency(path: string): void },
  ): Promise<{ build(candidates: string[]): string }>;
};

async function loadTailwind(appDir: string): Promise<TailwindNode> {
  // `@tailwindcss/node` is not a dependency of the app, only of its Vite plugin, so resolve it
  // from there rather than from this script.
  const fromApp = createRequire(path.join(appDir, 'package.json'));
  const fromPlugin = createRequire(fromApp.resolve('@tailwindcss/vite'));
  return (await import(fromPlugin.resolve('@tailwindcss/node'))) as TailwindNode;
}

/** Reverses CSS identifier escaping: `\:` → `:`, `\32 xl` → `2xl`. */
export function unescapeSelector(selector: string): string {
  return selector
    .replace(/\\([0-9a-fA-F]{1,6}) ?/g, (_, hex: string) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/\\(.)/g, '$1');
}

export async function compileTokens(
  appDir: string,
  candidates: Iterable<string>,
): Promise<Compiled> {
  const tailwind = await loadTailwind(appDir);
  const base = path.join(appDir, 'src');
  const css = readFileSync(path.join(base, 'index.css'), 'utf8');
  const compiler = await tailwind.compile(css, { base, onDependency() {} });
  const list = [...new Set(candidates)].sort();
  const root = postcss.parse(compiler.build(list));

  const tokens = new Map<string, CompiledToken>();
  const themeVars = new Map<string, string>();
  const globals: string[] = [];
  let order = 0;

  const wanted = new Set(list);
  // A class as it appears in a selector: `.hover\:underline`, `.\32 xl\:p-4`, `.\[\&_svg\]\:size-4`.
  const classPattern = /\.((?:\\[0-9a-fA-F]{1,6} ?|\\.|[\w-])+)/g;

  const index = (container: AtRule, queries: Query[]) => {
    for (const node of container.nodes ?? []) {
      if (node.type === 'atrule') {
        if (node.name === 'media' || node.name === 'supports' || node.name === 'container') {
          index(node, [...queries, { kind: `@${node.name}`, params: node.params }]);
        } else if (node.name === 'layer') {
          index(node, queries);
        }
        continue;
      }
      if (node.type !== 'rule') continue;
      for (const selector of node.selectors) {
        for (const match of selector.matchAll(classPattern)) {
          const token = unescapeSelector(match[1]);
          if (!wanted.has(token)) continue;
          const template =
            selector.slice(0, match.index) + '&' + selector.slice(match.index + match[0].length);
          let compiled = tokens.get(token);
          if (!compiled) {
            compiled = { token, entries: [] };
            tokens.set(token, compiled);
          }
          compiled.entries.push({ selector: template, queries, rule: node, order: order++ });
          break;
        }
      }
    }
  };

  root.walkAtRules('layer', layer => {
    if (layer.parent?.type !== 'root') return;
    if (layer.params === 'utilities' && layer.nodes) index(layer, []);
    if (layer.params === 'theme') {
      layer.walkDecls((decl: Declaration) => {
        if (decl.prop.startsWith('--')) themeVars.set(decl.prop, decl.value);
      });
    }
    if (layer.params === 'properties' && layer.nodes?.length) {
      globals.push(layer.toString());
    }
  });

  for (const node of root.nodes) {
    if (node.type === 'atrule' && (node.name === 'property' || node.name === 'keyframes')) {
      globals.push((node as AtRule).toString());
    }
  }

  return { tokens, themeVars, globals };
}
