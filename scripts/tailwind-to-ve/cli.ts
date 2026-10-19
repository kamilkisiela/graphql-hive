/**
 * Tailwind → Vanilla Extract codemod for `packages/web/app`.
 *
 *   pnpm tsx scripts/tailwind-to-ve/cli.ts --scope components/ui [--scope pages] [--dry] [--force]
 *
 * 1. Scans every source file for class strings and compiles the union with Tailwind, once.
 * 2. Rewrites the files under each `--scope` (relative to `src`), writing a `.css.ts` beside each.
 * 3. Writes `src/styles/tailwind-defaults.css` with the Tailwind theme variables, `@property`
 *    registrations and keyframes that the compiled styles reference, computed over the whole app.
 * 4. Prints a report: unknown classes kept as literals, cva calls it could not convert, and a
 *    few things worth a human look.
 *
 * See README.md in this directory for the mapping rules.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { compileTokens } from './tailwind.ts';
import { tokensIn, transformFile, type FileReport } from './transform.ts';

const args = process.argv.slice(2);
const flag = (name: string) => args.includes(name);
const values = (name: string) =>
  args.flatMap((a, i) => (a === name && args[i + 1] ? [args[i + 1]] : []));

const repoRoot = path.resolve(import.meta.dirname, '../..');
const appDir = path.join(repoRoot, 'packages/web/app');
const srcDir = path.join(appDir, 'src');
const scopes = values('--scope');
const dry = flag('--dry');
const force = flag('--force');
const printCss = flag('--print');

if (!scopes.length) {
  console.error('Pass at least one --scope <dir relative to packages/web/app/src>');
  process.exit(2);
}

function listSourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'gql' || entry.name === 'node_modules') continue;
      out.push(...listSourceFiles(full));
      continue;
    }
    if (!/\.tsx?$/.test(entry.name)) continue;
    if (/\.(css|d|spec|test|generated)\.tsx?$/.test(entry.name) || entry.name.endsWith('.gen.d.ts'))
      continue;
    out.push(full);
  }
  return out.sort();
}

/** `components/ui`, `components/v2` and `components/base` are the design system; the rest are call sites. */
function layerFor(absPath: string): 'components' | 'utilities' {
  const rel = path.relative(srcDir, absPath);
  return /^components\/(ui|v2|base)\//.test(rel) ? 'components' : 'utilities';
}

function appThemeVariableNames(): Set<string> {
  const css = readFileSync(path.join(srcDir, 'index.css'), 'utf8');
  const start = css.indexOf('@theme');
  const open = css.indexOf('{', start);
  let depth = 0;
  let end = open;
  for (let i = open; i < css.length; i++) {
    if (css[i] === '{') depth++;
    if (css[i] === '}' && --depth === 0) {
      end = i;
      break;
    }
  }
  return new Set([...css.slice(open, end).matchAll(/(--[\w-]+)\s*:/g)].map(m => m[1]));
}

async function main() {
  const allFiles = listSourceFiles(srcDir);
  const texts = new Map(allFiles.map(f => [f, readFileSync(f, 'utf8')] as const));

  const candidates = new Set<string>();
  for (const [file, text] of texts) for (const t of tokensIn(file, text)) candidates.add(t);
  console.error(`Compiling ${candidates.size} distinct classes from ${allFiles.length} files…`);
  const compiled = await compileTokens(appDir, candidates);
  console.error(`Tailwind recognised ${compiled.tokens.size} of them.`);

  const inScope = allFiles.filter(f =>
    scopes.some(
      s =>
        path.relative(srcDir, f).startsWith(s.replace(/\/$/, '') + '/') ||
        path.relative(srcDir, f) === s,
    ),
  );
  const written: string[] = [];
  const reports: FileReport[] = [];

  for (const file of inScope) {
    const result = transformFile(file, texts.get(file)!, {
      srcDir,
      compiled,
      layer: layerFor(file),
    });
    if (!result) continue;
    reports.push(result.report);
    const cssPath = file.replace(/\.tsx?$/, '.css.ts');
    if (existsSync(cssPath) && !force) {
      console.error(`Refusing to overwrite ${path.relative(repoRoot, cssPath)} (pass --force).`);
      process.exit(1);
    }
    if (printCss) {
      console.log(`\n// ===== ${path.relative(repoRoot, cssPath)}\n${result.css}`);
      console.log(`\n// ===== ${path.relative(repoRoot, file)}\n${result.source}`);
    }
    if (!dry) {
      writeFileSync(cssPath, result.css);
      writeFileSync(file, result.source);
      written.push(cssPath, file);
    }
  }

  // Tailwind's own theme variables, @property registrations and keyframes that the compiled styles
  // reference. Computed over the whole app, so it is complete from the first run.
  const own = appThemeVariableNames();
  // Keyframes `index.css` declares are ported by hand (animations.css.ts) or dead; keep Tailwind's.
  const ownKeyframes = new Set(
    [
      ...readFileSync(path.join(srcDir, 'index.css'), 'utf8').matchAll(/@keyframes\s+([\w-]+)/g),
    ].map(m => m[1]),
  );
  const globals = compiled.globals.filter(css => {
    const keyframes = css.match(/^@keyframes\s+([\w-]+)/);
    return keyframes ? !ownKeyframes.has(keyframes[1]) : true;
  });
  const themeLines = [...compiled.themeVars]
    .filter(([name]) => !own.has(name))
    .map(([name, value]) => `    ${name}: ${value};`);
  const defaults = [
    '/*',
    ' * Generated by scripts/tailwind-to-ve. Do not edit by hand; re-run the codemod instead.',
    " * Tailwind's default theme variables, `@property` registrations and keyframes that the",
    " * compiled styles reference. The app's own tokens live in theme.css.ts and animations.css.ts.",
    ' */',
    '@layer theme {',
    '  :root,',
    '  :host {',
    ...themeLines,
    '  }',
    '}',
    '',
    ...globals,
    '',
  ].join('\n');
  const defaultsPath = path.join(srcDir, 'styles/tailwind-defaults.css');
  if (!dry) {
    writeFileSync(defaultsPath, defaults);
    written.push(defaultsPath);
  }

  if (written.length) {
    execFileSync('pnpm', ['exec', 'prettier', '--write', '--log-level', 'warn', ...written], {
      cwd: repoRoot,
      stdio: 'inherit',
    });
    execFileSync('pnpm', ['exec', 'eslint', '--fix', ...written.filter(f => !f.endsWith('.css'))], {
      cwd: repoRoot,
      stdio: 'inherit',
    });
  }

  // Report ------------------------------------------------------------------------------------
  const unknown = new Map<string, number>();
  for (const r of reports)
    for (const [t, n] of r.unknownTokens) unknown.set(t, (unknown.get(t) ?? 0) + n);
  const lines = [
    `# tailwind-to-ve ${dry ? '(dry run) ' : ''}report`,
    '',
    `Scope: ${scopes.join(', ')}`,
    `Files rewritten: ${reports.length} of ${inScope.length} in scope`,
    `Styles: ${reports.reduce((n, r) => n + r.styles, 0)}, recipes: ${reports.reduce((n, r) => n + r.recipes, 0)}`,
    '',
  ];
  if (unknown.size) {
    lines.push('## Classes Tailwind did not recognise (kept as literal strings)', '');
    for (const [t, n] of [...unknown].sort((a, b) => b[1] - a[1])) lines.push(`- \`${t}\` ×${n}`);
    lines.push('');
  }
  const dynamic = reports.flatMap(r => r.dynamicCva.map(d => `- ${r.file}: ${d}`));
  if (dynamic.length) lines.push('## cva calls left as-is (not static)', '', ...dynamic, '');
  const notes = reports.flatMap(r => r.notes.map(n => `- ${r.file}: ${n}`));
  if (notes.length) lines.push('## Worth a look', '', ...notes, '');
  const perFile = reports.filter(r => r.unknownTokens.size);
  if (perFile.length) {
    lines.push('## Per file', '');
    for (const r of perFile)
      lines.push(`- ${r.file}: ${[...r.unknownTokens.keys()].map(t => `\`${t}\``).join(' ')}`);
    lines.push('');
  }
  const report = lines.join('\n');
  console.log(report);
  for (const out of values('--report')) writeFileSync(path.resolve(out), report);
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
