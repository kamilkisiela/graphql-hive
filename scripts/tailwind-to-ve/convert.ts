/**
 * Turns the rules Tailwind compiled for a set of classes into one Vanilla Extract style object,
 * and renders that object as TypeScript source.
 *
 * Declarations merge in Tailwind's order, so a later utility overrides an earlier one exactly as
 * it does in the real stylesheet. Variants become `selectors` and `@media`/`@supports`/
 * `@container` branches. A selector whose subject is not the element itself (`& svg`,
 * `:is(& > *)`) cannot live in `style()`, so it is returned separately for a `globalStyle`.
 */
import type { ChildNode, Container } from 'postcss';
import type { CompiledToken, Query } from './tailwind.ts';

/** One leaf: declarations under a selector (with `&`) and a chain of queries. */
type Leaf = { selector: string; queries: Query[]; decls: Map<string, string> };

export type StyleTree = {
  decls: Map<string, string>;
  queries: Map<string, { query: Query; tree: StyleTree }>;
  selectors: Map<string, StyleTree>;
};

export type Converted = {
  /** The part that belongs in `style()`. */
  local: StyleTree;
  /** Descendant and sibling rules, to emit with `globalStyle`. `&` stands for the class. */
  globals: Array<{ selector: string; tree: StyleTree }>;
};

const newTree = (): StyleTree => ({ decls: new Map(), queries: new Map(), selectors: new Map() });

/** Set a declaration so that the last write also comes last in iteration order, like CSS. */
function setDecl(decls: Map<string, string>, prop: string, value: string) {
  decls.delete(prop);
  decls.set(prop, value);
}

function collectLeaves(
  container: Container<ChildNode>,
  selector: string,
  queries: Query[],
  out: Leaf[],
) {
  let leaf: Leaf | undefined;
  for (const node of container.nodes ?? []) {
    if (node.type === 'decl') {
      leaf ??= { selector, queries, decls: new Map() };
      setDecl(leaf.decls, node.prop, node.important ? `${node.value} !important` : node.value);
      out.includes(leaf) || out.push(leaf);
    } else if (node.type === 'rule') {
      // CSS nesting: the inner `&` stands for the outer selector.
      for (const part of node.selectors) {
        const composed = part.includes('&')
          ? part.replaceAll('&', selector)
          : `${selector} ${part}`;
        collectLeaves(node, composed, queries, out);
      }
    } else if (node.type === 'atrule') {
      if (node.name === 'media' || node.name === 'supports' || node.name === 'container') {
        collectLeaves(
          node,
          selector,
          [...queries, { kind: `@${node.name}`, params: node.params }],
          out,
        );
      } else if (node.name === 'layer') {
        collectLeaves(node, selector, queries, out);
      }
      // Anything else (`@property`, `@keyframes`) is handled globally by the compiler step.
    }
  }
}

/** Top-level combinators split compounds; the subject is the last compound. */
function subjectIsSelf(selector: string): boolean {
  let depth = 0;
  let lastCompoundStart = 0;
  for (let i = 0; i < selector.length; i++) {
    const ch = selector[i];
    if (ch === '(' || ch === '[') depth++;
    else if (ch === ')' || ch === ']') depth--;
    else if (depth === 0 && (ch === ' ' || ch === '>' || ch === '+' || ch === '~')) {
      // Skip runs of combinator characters and whitespace.
      while (i + 1 < selector.length && /[\s>+~]/.test(selector[i + 1])) i++;
      lastCompoundStart = i + 1;
    }
  }
  return selector.slice(lastCompoundStart).startsWith('&');
}

/**
 * Vanilla Extract does not nest a query inside another of the same kind, so consecutive `@media`
 * (or `@supports`) conditions are combined with `and`, which means the same thing.
 */
function foldQueries(queries: Query[]): Query[] {
  const out: Query[] = [];
  for (const query of queries) {
    const last = out[out.length - 1];
    if (last && last.kind === query.kind && query.kind !== '@container') {
      out[out.length - 1] = { kind: last.kind, params: `${last.params} and ${query.params}` };
    } else {
      out.push(query);
    }
  }
  return out;
}

function placeLeaf(root: StyleTree, leaf: Leaf, selectorKey: string | null) {
  let tree = root;
  for (const query of foldQueries(leaf.queries)) {
    const key = `${query.kind} ${query.params}`;
    let branch = tree.queries.get(key);
    if (!branch) {
      branch = { query, tree: newTree() };
      tree.queries.set(key, branch);
    }
    tree = branch.tree;
  }
  if (selectorKey !== null) {
    let branch = tree.selectors.get(selectorKey);
    if (!branch) {
      branch = newTree();
      tree.selectors.set(selectorKey, branch);
    }
    tree = branch;
  }
  for (const [prop, value] of leaf.decls) setDecl(tree.decls, prop, value);
}

/**
 * Converts the compiled rules for the given classes, in Tailwind's order, into one style.
 * Classes are assumed to all target the same element, which is what a class string means.
 */
export function convert(compiledTokens: CompiledToken[]): Converted {
  const entries = compiledTokens.flatMap(t => t.entries).sort((a, b) => a.order - b.order);
  const leaves: Leaf[] = [];
  for (const entry of entries) {
    collectLeaves(entry.rule, entry.selector, entry.queries, leaves);
  }

  const local = newTree();
  const globals = new Map<string, StyleTree>();
  for (const leaf of leaves) {
    if (leaf.selector === '&') {
      placeLeaf(local, leaf, null);
    } else if (subjectIsSelf(leaf.selector)) {
      placeLeaf(local, leaf, leaf.selector);
    } else {
      let tree = globals.get(leaf.selector);
      if (!tree) {
        tree = newTree();
        globals.set(leaf.selector, tree);
      }
      placeLeaf(tree, leaf, null);
    }
  }
  return { local, globals: [...globals].map(([selector, tree]) => ({ selector, tree })) };
}

// Rendering -----------------------------------------------------------------------------------

export function cssPropToJs(prop: string): string {
  if (prop.startsWith('-ms-')) return 'ms' + camel(prop.slice(4), true);
  if (prop.startsWith('-')) return camel(prop.slice(1), true);
  return camel(prop, false);
}

function camel(input: string, pascal: boolean): string {
  const out = input.replace(/-([a-z0-9])/g, (_, c: string) => c.toUpperCase());
  return pascal ? out[0].toUpperCase() + out.slice(1) : out;
}

export function quote(value: string): string {
  return `'${value.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
}

function key(name: string): string {
  return /^[A-Za-z_$][\w$]*$/.test(name) ? name : quote(name);
}

const indent = (depth: number) => '  '.repeat(depth);

/**
 * Properties the repo's pinned `csstype` (3.1.2, held back for react-select) does not know. They
 * are spread in from an untyped object so the value still reaches the stylesheet.
 */
const UNTYPED_PROPERTIES = new Set(['textWrap']);

/** Renders a tree as the body of a style object, without the surrounding braces. */
function renderBody(tree: StyleTree, depth: number): string[] {
  const lines: string[] = [];
  const vars: Array<[string, string]> = [];
  for (const [prop, value] of tree.decls) {
    const name = cssPropToJs(prop);
    if (prop.startsWith('--')) vars.push([prop, value]);
    else if (UNTYPED_PROPERTIES.has(name)) {
      lines.push(`${indent(depth)}...({ ${name}: ${quote(value)} } as object),`);
    } else lines.push(`${indent(depth)}${key(name)}: ${quote(value)},`);
  }
  if (vars.length) {
    lines.push(`${indent(depth)}vars: {`);
    for (const [prop, value] of vars)
      lines.push(`${indent(depth + 1)}${quote(prop)}: ${quote(value)},`);
    lines.push(`${indent(depth)}},`);
  }
  if (tree.selectors.size) {
    lines.push(`${indent(depth)}selectors: {`);
    for (const [selector, sub] of tree.selectors) {
      lines.push(`${indent(depth + 1)}${quote(selector)}: {`);
      lines.push(...renderBody(sub, depth + 2));
      lines.push(`${indent(depth + 1)}},`);
    }
    lines.push(`${indent(depth)}},`);
  }
  const byKind = new Map<string, Array<{ params: string; tree: StyleTree }>>();
  for (const { query, tree: sub } of tree.queries.values()) {
    const list = byKind.get(query.kind) ?? [];
    list.push({ params: query.params, tree: sub });
    byKind.set(query.kind, list);
  }
  for (const [kind, list] of byKind) {
    lines.push(`${indent(depth)}${quote(kind)}: {`);
    for (const { params, tree: sub } of list) {
      lines.push(`${indent(depth + 1)}${quote(params)}: {`);
      lines.push(...renderBody(sub, depth + 2));
      lines.push(`${indent(depth + 1)}},`);
    }
    lines.push(`${indent(depth)}},`);
  }
  return lines;
}

/** `{ ... }` wrapped in the given cascade layer, as `'@layer': { [layer]: { ... } }`. */
export function renderStyleObject(tree: StyleTree, layerExpr: string, depth = 0): string {
  const body = renderBody(tree, depth + 3);
  return [
    `{`,
    `${indent(depth + 1)}'@layer': {`,
    `${indent(depth + 2)}[${layerExpr}]: {`,
    ...body,
    `${indent(depth + 2)}},`,
    `${indent(depth + 1)}},`,
    `${indent(depth)}}`,
  ].join('\n');
}

export function isEmpty(tree: StyleTree): boolean {
  return tree.decls.size === 0 && tree.queries.size === 0 && tree.selectors.size === 0;
}
