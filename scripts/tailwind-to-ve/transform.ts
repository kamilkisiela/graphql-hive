/**
 * Rewrites one source file: every class string becomes a reference into a sibling `.css.ts`,
 * which this module also produces. Edits are applied to the original text from the end backwards,
 * so formatting outside the touched ranges is untouched; Prettier runs afterwards.
 */
import path from 'node:path';
import ts from 'typescript';
import { convert, isEmpty, quote, renderStyleObject, type StyleTree } from './convert.ts';
import { identifiers, scan, splitTokens, toCamel, type ClassParts } from './scan.ts';
import type { Compiled, CompiledToken } from './tailwind.ts';

/** Classes the app defines itself, already ported by hand to `src/styles`. */
const MAPPED: Record<string, { module: string; binding: string; expr: string }> = {
  container: { module: 'utilities.css', binding: 'utilities', expr: 'utilities.container' },
  'thin-scrollbar': {
    module: 'utilities.css',
    binding: 'utilities',
    expr: 'utilities.thinScrollbar',
  },
  'no-scrollbar': { module: 'utilities.css', binding: 'utilities', expr: 'utilities.noScrollbar' },
  'bg-dot-line-strong': {
    module: 'patterns.css',
    binding: 'patterns',
    expr: 'patterns.bgDot.lineStrong',
  },
  'bg-grid-neutral-5': {
    module: 'patterns.css',
    binding: 'patterns',
    expr: 'patterns.bgGrid.neutral5',
  },
  'bg-grid-small-neutral-5': {
    module: 'patterns.css',
    binding: 'patterns',
    expr: 'patterns.bgGridSmall.neutral5',
  },
};

/** Inert marker classes that selectors elsewhere key on. Kept as literal strings, not reported. */
const MARKER = /^(group|peer)(\/[\w-]+)?$/;

const RESERVED = new Set([
  'style',
  'globalStyle',
  'recipe',
  'layer',
  'utilities',
  'patterns',
  'default',
  'class',
  'delete',
  'export',
  'import',
  'new',
  'var',
  'let',
  'const',
  'function',
  'return',
  'switch',
]);

export type FileReport = {
  file: string;
  styles: number;
  recipes: number;
  unknownTokens: Map<string, number>;
  dynamicCva: string[];
  notes: string[];
};

export type TransformResult = {
  source: string;
  css: string;
  report: FileReport;
} | null;

export type TransformOptions = {
  srcDir: string;
  compiled: Compiled;
  /** Which cascade layer this file's styles belong to. */
  layer: 'components' | 'utilities';
};

type Resolved = {
  compiled: CompiledToken[];
  mapped: string[];
  leftovers: string[];
  markers: string[];
};

function resolveTokens(tokens: string[], compiled: Compiled, report: FileReport): Resolved {
  const out: Resolved = { compiled: [], mapped: [], leftovers: [], markers: [] };
  for (const token of tokens) {
    if (MAPPED[token]) out.mapped.push(token);
    else if (compiled.tokens.has(token)) out.compiled.push(compiled.tokens.get(token)!);
    else if (MARKER.test(token)) out.markers.push(token);
    else {
      out.leftovers.push(token);
      report.unknownTokens.set(token, (report.unknownTokens.get(token) ?? 0) + 1);
    }
  }
  return out;
}

class Names {
  private used = new Set<string>(RESERVED);
  claim(hint: string): string {
    const base = /^[A-Za-z_$][\w$]*$/.test(hint) ? hint : toCamel([hint]);
    let name = base;
    for (let i = 2; this.used.has(name); i++) name = `${base}${i}`;
    this.used.add(name);
    return name;
  }
}

class CssModule {
  readonly lines: string[] = [];
  /** globalStyle lines waiting for the style they reference to be declared first. */
  private pendingGlobals: string[] = [];
  readonly bindings = new Set<string>();
  usesStyle = false;
  usesGlobalStyle = false;
  usesRecipe = false;
  constructor(readonly layerExpr: string) {}

  /** Renders a style expression for the resolved tokens; emits globalStyle lines for descendants. */
  styleExpr(name: string, resolved: Resolved): string {
    for (const token of resolved.mapped) this.bindings.add(MAPPED[token].binding);
    const composes = resolved.mapped.map(token => MAPPED[token].expr);
    const converted = convert(resolved.compiled);
    const object = isEmpty(converted.local)
      ? null
      : renderStyleObject(converted.local, this.layerExpr);
    for (const global of converted.globals) {
      this.usesGlobalStyle = true;
      this.pendingGlobals.push(
        `globalStyle(\`${global.selector.replaceAll('&', `\${${name}}`)}\`, ${renderStyleObject(global.tree, this.layerExpr)});`,
        '',
      );
    }
    this.usesStyle = true;
    if (!object && composes.length === 1) return `style([${composes[0]}])`;
    const parts = [...composes, ...(object ? [object] : [])];
    return parts.length === 1 ? `style(${parts[0]})` : `style([${parts.join(', ')}])`;
  }

  /** The globalStyle lines produced since the last flush. Call after the declaration they need. */
  flushGlobals(): string[] {
    const out = this.pendingGlobals;
    this.pendingGlobals = [];
    return out;
  }

  /** Like `styleExpr`, but for a recipe part, which has no class handle for globalStyle. */
  recipePart(hoistName: string, resolved: Resolved, refs: string[], hoisted: string[]): string {
    const converted = convert(resolved.compiled);
    const composes = [...refs, ...resolved.mapped.map(token => MAPPED[token].expr)];
    for (const token of resolved.mapped) this.bindings.add(MAPPED[token].binding);
    if (converted.globals.length) {
      // Needs a class of its own so descendant rules can reference it.
      const own = this.styleExpr(hoistName, resolved);
      const expr = refs.length
        ? own.replace(/^style\(/, `style([${refs.join(', ')}, `).replace(/\)$/, '])')
        : own;
      hoisted.push(`const ${hoistName} = ${expr};`, '', ...this.flushGlobals());
      return hoistName;
    }
    const object = isEmpty(converted.local)
      ? null
      : renderStyleObject(converted.local, this.layerExpr);
    const parts = [...composes, ...(object ? [object] : [])];
    if (!parts.length) return '{}';
    return parts.length === 1 && object ? object : `[${parts.join(', ')}]`;
  }
}

function literalFor(tokens: string[]): string {
  return quote(tokens.join(' '));
}

export function transformFile(
  absPath: string,
  text: string,
  options: TransformOptions,
): TransformResult {
  const { sites, cva, file } = scan(absPath, text);
  const report: FileReport = {
    file: path.relative(options.srcDir, absPath),
    styles: 0,
    recipes: 0,
    unknownTokens: new Map(),
    dynamicCva: [],
    notes: [],
  };
  if (!sites.length && !cva.length) return null;

  const names = new Names();
  const layerExpr = 'layer';
  const css = new CssModule(layerExpr);
  const edits: Array<{ start: number; end: number; text: string }> = [];
  const names_ = identifiers(file);
  const stylesId = names_.has('styles') ? 'veStyles' : 'styles';
  let needsCombinator = false;

  // Where each imported binding comes from, so a recipe can import the class values it composes.
  const importOf = new Map<string, { module: string; named: boolean; typeOnly: boolean }>();
  for (const statement of file.statements) {
    if (!ts.isImportDeclaration(statement) || !statement.importClause) continue;
    const module = (statement.moduleSpecifier as ts.StringLiteral).text;
    const clause = statement.importClause;
    if (clause.name)
      importOf.set(clause.name.text, { module, named: false, typeOnly: clause.isTypeOnly });
    if (clause.namedBindings && ts.isNamedImports(clause.namedBindings)) {
      for (const el of clause.namedBindings.elements) {
        importOf.set(el.name.text, {
          module,
          named: true,
          typeOnly: clause.isTypeOnly || el.isTypeOnly,
        });
      }
    }
  }
  const neededImports = new Map<string, Set<string>>(); // module → bindings
  /** A reference a recipe part composes. Only imported bindings can be reached from the .css.ts. */
  const resolveRefs = (parts: ClassParts): string[] | null => {
    for (const ref of parts.refs) {
      const root = ref.split('.')[0];
      const imp = importOf.get(root);
      if (!imp || imp.typeOnly || !imp.named) return null;
      const set = neededImports.get(imp.module) ?? new Set<string>();
      set.add(root);
      neededImports.set(imp.module, set);
    }
    return parts.refs;
  };

  // cva → recipe ------------------------------------------------------------------------------
  const cvaNames = new Map<string, string>();
  for (const site of cva) {
    const allRefs = [
      site.base,
      ...site.variants.map(v => v.parts),
      ...site.compound.map(c => c.parts),
    ];
    const unresolvable = allRefs
      .flatMap(p => p.refs)
      .find(ref => !importOf.get(ref.split('.')[0])?.named);
    if (site.dynamic || unresolvable) {
      report.dynamicCva.push(
        `${site.name}: ${site.dynamic ?? `composes local value ${unresolvable}`}`,
      );
      continue;
    }
    const name = names.claim(site.name);
    cvaNames.set(site.name, name);
    const hoisted: string[] = [];
    const base = css.recipePart(
      `${name}Base`,
      resolveTokens(site.base.tokens, options.compiled, report),
      resolveRefs(site.base)!,
      hoisted,
    );
    const groups = new Map<string, string[]>();
    for (const v of site.variants) {
      const part = css.recipePart(
        `${name}${toCamel([v.group, v.option]).replace(/^./, c => c.toUpperCase())}`,
        resolveTokens(v.parts.tokens, options.compiled, report),
        resolveRefs(v.parts)!,
        hoisted,
      );
      const list = groups.get(v.group) ?? [];
      list.push(`${/^[A-Za-z_$][\w$]*$/.test(v.option) ? v.option : quote(v.option)}: ${part},`);
      groups.set(v.group, list);
    }
    const compound: string[] = [];
    for (const c of site.compound) {
      // recipe has no array selections; expand them.
      const keys = Object.keys(c.selection);
      const combos: Array<Record<string, string | boolean>> = [{}];
      for (const key of keys) {
        const values = c.selection[key];
        const list = Array.isArray(values) ? values : [values];
        const next: Array<Record<string, string | boolean>> = [];
        for (const combo of combos) for (const value of list) next.push({ ...combo, [key]: value });
        combos.splice(0, combos.length, ...next);
      }
      const part = css.recipePart(
        `${name}Compound${compound.length + 1}`,
        resolveTokens(c.parts.tokens, options.compiled, report),
        resolveRefs(c.parts)!,
        hoisted,
      );
      for (const combo of combos) {
        const selection = Object.entries(combo)
          .map(([k, v]) => `${k}: ${typeof v === 'string' ? quote(v) : v}`)
          .join(', ');
        compound.push(`{ variants: { ${selection} }, style: ${part} },`);
      }
    }
    css.usesRecipe = true;
    css.lines.push(...hoisted);
    css.lines.push(`export const ${name} = recipe({`);
    css.lines.push(`  base: ${base},`);
    if (groups.size) {
      css.lines.push('  variants: {');
      for (const [group, options_] of groups) {
        css.lines.push(`    ${group}: {`, ...options_.map(l => `      ${l}`), '    },');
      }
      css.lines.push('  },');
    }
    if (compound.length)
      css.lines.push('  compoundVariants: [', ...compound.map(l => `    ${l}`), '  ],');
    if (site.defaultVariants) css.lines.push(`  defaultVariants: ${site.defaultVariants},`);
    css.lines.push('});', '');
    report.recipes++;
    edits.push({ start: site.start, end: site.end, text: `lenient(${stylesId}.${name})` });
  }

  // Class strings -----------------------------------------------------------------------------
  for (const site of sites) {
    // A constant is only a class string if every token is one; prose and paths in a `*Styles`
    // object must stay untouched. Attributes and class-function arguments are class strings by
    // position, so there unknown tokens are kept as literals and reported.
    if (site.kind === 'constant') {
      const known = site.tokens.every(
        t => MAPPED[t] || options.compiled.tokens.has(t) || MARKER.test(t),
      );
      if (!known) continue;
      // A single plain word (`outline`, `hidden`, `block`) is as likely a prop value as a class.
      if (site.tokens.length === 1 && /^[a-z]+$/.test(site.tokens[0])) {
        report.notes.push(
          `constant left alone, one ambiguous word: '${site.text}' (${site.nameHint})`,
        );
        continue;
      }
    }
    const resolved = resolveTokens(site.tokens, options.compiled, report);
    if (!resolved.compiled.length && !resolved.mapped.length) continue;
    if (site.kind === 'quasi' && resolved.leftovers.some(t => /[:-]$/.test(t))) {
      report.notes.push(
        `dynamic class built in a template literal: \`${site.text}\` (${site.nameHint})`,
      );
    }
    const name = names.claim(site.nameHint);
    const expr = css.styleExpr(name, resolved);
    css.lines.push(`export const ${name} = ${expr};`, '', ...css.flushGlobals());
    report.styles++;
    const ref = `${stylesId}.${name}`;
    const rest = [...resolved.markers, ...resolved.leftovers];
    let replacement: string;
    switch (site.kind) {
      case 'attribute':
        if (rest.length) {
          needsCombinator = true;
          replacement = `{__COMBINE__(${ref}, ${literalFor(rest)})}`;
        } else {
          replacement = `{${ref}}`;
        }
        break;
      case 'quasi': {
        const lead = /^\s/.test(site.text) ? ' ' : '';
        const trail = /\s$/.test(site.text) ? ' ' : '';
        replacement = `${lead}\${${ref}}${rest.length ? ' ' + rest.join(' ') : ''}${trail}`;
        break;
      }
      case 'literal':
      case 'constant':
        if (!rest.length) replacement = ref;
        else if (site.directArg) replacement = `${ref}, ${literalFor(rest)}`;
        else replacement = `\`\${${ref}} ${rest.join(' ')}\``;
        break;
    }
    edits.push({ start: site.start, end: site.end, text: replacement });
  }

  if (!css.lines.length) return null;

  // `variants({ ..., className })` → `cn(variants({ ... }), className)` ----------------------
  // cva merged a `className` passed through the variants function; recipe does not accept it.
  const visitCalls = (node: ts.Node) => {
    if (
      ts.isCallExpression(node) &&
      ts.isIdentifier(node.expression) &&
      // A converted recipe, or by the codebase's naming any variants function: lifting the class
      // out of a `cva` call is equally valid, since `cn` merges it the same way.
      (cvaNames.has(node.expression.text) || /Variants$/.test(node.expression.text)) &&
      node.arguments.length === 1 &&
      ts.isObjectLiteralExpression(node.arguments[0])
    ) {
      const object = node.arguments[0];
      const passthrough = object.properties.find(
        p =>
          (ts.isShorthandPropertyAssignment(p) || ts.isPropertyAssignment(p)) &&
          ts.isIdentifier(p.name) &&
          (p.name.text === 'className' || p.name.text === 'class'),
      );
      if (passthrough) {
        // The class value may itself have been rewritten already (a string literal became
        // `styles.x`): reuse that replacement and drop the inner edit, so the two never overlap.
        // Any other edit inside the call would be lost by re-emitting it, so leave such calls alone.
        const inner = edits.filter(e => e.start >= node.getStart() && e.end <= node.getEnd());
        for (const e of inner) edits.splice(edits.indexOf(e), 1);
        const withEdits = (n: ts.Node) => applyEdits(text, n.getStart(), n.getEnd(), inner);
        const valueNode = ts.isPropertyAssignment(passthrough)
          ? passthrough.initializer
          : passthrough.name;
        const classExpr = withEdits(valueNode);
        const rest = object.properties.filter(p => p !== passthrough).map(withEdits);
        const call = `${node.expression.text}(${rest.length ? `{ ${rest.join(', ')} }` : ''})`;
        const parent = node.parent;
        const inClassCall = isDirectClassArg(node);
        needsCombinator ||= !inClassCall;
        edits.push({
          start: node.getStart(),
          end: node.getEnd(),
          text: inClassCall ? `${call}, ${classExpr}` : `__COMBINE__(${call}, ${classExpr})`,
        });
        void parent;
        return;
      }
    }
    ts.forEachChild(node, visitCalls);
  };
  visitCalls(file);

  // VariantProps → RecipeVariants ------------------------------------------------------------
  const visitTypes = (node: ts.Node) => {
    if (
      ts.isTypeReferenceNode(node) &&
      node.typeName.getText() === 'VariantProps' &&
      node.typeArguments?.length === 1 &&
      cvaNames.has(node.typeArguments[0].getText().replace(/^typeof\s+/, ''))
    ) {
      edits.push({
        start: node.getStart(),
        end: node.getEnd(),
        text: `NonNullable<Parameters<${node.typeArguments[0].getText()}>[0]>`,
      });
      return;
    }
    ts.forEachChild(node, visitTypes);
  };
  visitTypes(file);

  // Imports ----------------------------------------------------------------------------------
  let lastImportEnd = 0;
  let hasCn = false;
  let hasClsx = false;
  for (const statement of file.statements) {
    if (!ts.isImportDeclaration(statement)) continue;
    lastImportEnd = statement.getEnd();
    const spec = (statement.moduleSpecifier as ts.StringLiteral).text;
    const named = statement.importClause?.namedBindings;
    const specifiers =
      named && ts.isNamedImports(named) ? named.elements.map(e => e.name.text) : [];
    if (spec === '@/lib/utils' && specifiers.includes('cn')) hasCn = true;
    if (spec === 'clsx' && specifiers.includes('clsx')) hasClsx = true;
    if (spec === 'class-variance-authority' && cvaNames.size && cvaNames.size === cva.length) {
      const keep = specifiers.filter(s => s !== 'cva' && s !== 'VariantProps');
      const replacement = [
        ...(keep.length ? [`import { ${keep.join(', ')} } from 'class-variance-authority';`] : []),
      ].join('\n');
      edits.push({ start: statement.getStart(), end: statement.getEnd(), text: replacement });
    }
  }
  const combinator = hasCn ? 'cn' : 'clsx';
  const extraImports: string[] = [];
  if (cvaNames.size) extraImports.push(`import { lenient } from '@/lib/recipe';`);
  if (needsCombinator && !hasCn && !hasClsx) extraImports.push(`import { clsx } from 'clsx';`);
  const cssImportPath = `./${path.basename(absPath).replace(/\.tsx?$/, '')}.css`;
  extraImports.push(`import * as ${stylesId} from '${cssImportPath}';`);
  edits.push({
    start: lastImportEnd,
    end: lastImportEnd,
    text: lastImportEnd ? `\n${extraImports.join('\n')}` : `${extraImports.join('\n')}\n\n`,
  });

  // Apply edits from the end so earlier offsets stay valid.
  edits.sort((a, b) => b.start - a.start || b.end - a.end);
  let source = text;
  for (const edit of edits) {
    source = source.slice(0, edit.start) + edit.text + source.slice(edit.end);
  }
  source = source.replaceAll('__COMBINE__(', `${combinator}(`);
  source = dropUnusedImports(
    source,
    absPath,
    new Set([...movedBindings(neededImports), 'cva', 'VariantProps']),
  );

  // css.ts header -----------------------------------------------------------------------------
  const stylesDir = path.join(options.srcDir, 'styles');
  const rel = (name: string) => {
    const p = path.relative(path.dirname(absPath), path.join(stylesDir, name)).replace(/\\/g, '/');
    return p.startsWith('.') ? p : `./${p}`;
  };
  const header: string[] = [];
  const veImports = [css.usesGlobalStyle && 'globalStyle', css.usesStyle && 'style'].filter(
    Boolean,
  ) as string[];
  if (veImports.length)
    header.push(`import { ${veImports.join(', ')} } from '@vanilla-extract/css';`);
  if (css.usesRecipe) header.push(`import { recipe } from '@vanilla-extract/recipes';`);
  header.push(`import { ${options.layer} as ${layerExpr} } from '${rel('layers.css')}';`);
  for (const binding of [...css.bindings].sort()) {
    const module = Object.values(MAPPED).find(m => m.binding === binding)!.module;
    header.push(`import * as ${binding} from '${rel(module)}';`);
  }
  for (const [module, bindings] of [...neededImports].sort()) {
    header.push(`import { ${[...bindings].sort().join(', ')} } from '${module}';`);
  }
  header.push(
    '',
    `// Generated by scripts/tailwind-to-ve from the Tailwind classes this file used.`,
    '',
  );

  return { source, css: [...header, ...css.lines].join('\n'), report };
}

/** Every class token in a file, for the one-shot compile. */
export function tokensIn(absPath: string, text: string): string[] {
  const { sites, cva } = scan(absPath, text);
  const out: string[] = [];
  for (const site of sites) out.push(...site.tokens);
  for (const site of cva) {
    if (site.dynamic) continue;
    out.push(...site.base.tokens);
    for (const v of site.variants) out.push(...v.parts.tokens);
    for (const c of site.compound) out.push(...c.parts.tokens);
  }
  return out.filter(t => !MAPPED[t] && !MARKER.test(t));
}

export { splitTokens };

function movedBindings(needed: Map<string, Set<string>>): string[] {
  return [...needed.values()].flatMap(set => [...set]);
}

/**
 * Removes named import specifiers from `candidates` that the rewritten source no longer uses:
 * constants a recipe now composes from the `.css.ts`, and the `cva` helpers. Nothing else is
 * touched, so an import the file used for other reasons stays.
 */
function dropUnusedImports(source: string, fileName: string, candidates: Set<string>): string {
  const file = scan(fileName, source).file;
  const used = new Map<string, number>();
  const count = (node: ts.Node) => {
    if (ts.isImportDeclaration(node)) return;
    if (ts.isIdentifier(node)) used.set(node.text, (used.get(node.text) ?? 0) + 1);
    ts.forEachChild(node, count);
  };
  count(file);

  const edits: Array<{ start: number; end: number; text: string }> = [];
  for (const statement of file.statements) {
    if (!ts.isImportDeclaration(statement) || !statement.importClause) continue;
    const clause = statement.importClause;
    const named = clause.namedBindings;
    if (!named || !ts.isNamedImports(named)) continue;
    const keep = named.elements.filter(
      el => !(candidates.has(el.name.text) && !used.get(el.name.text)),
    );
    if (keep.length === named.elements.length) continue;
    if (!keep.length && !clause.name) {
      const end = source.indexOf('\n', statement.getEnd());
      edits.push({
        start: statement.getStart(),
        end: end === -1 ? statement.getEnd() : end + 1,
        text: '',
      });
      continue;
    }
    const specifiers = keep.map(el => el.getText()).join(', ');
    const defaultPart = clause.name ? `${clause.name.text}, ` : '';
    const typePart = clause.isTypeOnly ? 'type ' : '';
    edits.push({
      start: statement.getStart(),
      end: statement.getEnd(),
      text: `import ${typePart}${defaultPart}{ ${specifiers} } from ${statement.moduleSpecifier.getText()};`,
    });
  }
  edits.sort((a, b) => b.start - a.start);
  let out = source;
  for (const edit of edits) out = out.slice(0, edit.start) + edit.text + out.slice(edit.end);
  return out;
}

/** Whether a node is itself an argument of `cn(...)`/`clsx(...)`, so it can expand to two args. */
function isDirectClassArg(node: ts.Node): boolean {
  const parent = node.parent;
  return (
    !!parent &&
    ts.isCallExpression(parent) &&
    ts.isIdentifier(parent.expression) &&
    ['cn', 'clsx', 'cx', 'twMerge'].includes(parent.expression.text) &&
    parent.arguments.includes(node as ts.Expression)
  );
}

/** The source between `start` and `end` with the edits that fall inside it applied. */
function applyEdits(
  text: string,
  start: number,
  end: number,
  edits: Array<{ start: number; end: number; text: string }>,
): string {
  const inside = edits
    .filter(e => e.start >= start && e.end <= end)
    .sort((a, b) => b.start - a.start);
  let out = text.slice(start, end);
  for (const e of inside) out = out.slice(0, e.start - start) + e.text + out.slice(e.end - start);
  return out;
}
