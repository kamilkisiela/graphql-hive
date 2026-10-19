/**
 * Finds the places in a source file where Tailwind classes live, using the TypeScript AST.
 *
 * A string is a class string when it sits in a class position: a `className` attribute, an
 * argument (at any depth) of `cn`, `clsx`, `cva` or `twMerge`, or the initializer of a constant
 * whose name says it holds classes. Everything else is left alone, however Tailwind-like it looks:
 * `type="hidden"` must stay a string.
 */
import ts from 'typescript';

export const CLASS_FUNCTIONS = new Set(['cn', 'clsx', 'cx', 'twMerge', 'cva']);
const CLASS_NAME_PATTERN = /(class|classes|className|classNames|style|styles|variant|variants)$/i;
const STYLE_FILE_PATTERN = /(^|[-.])styles?\.tsx?$/;

export type SiteKind =
  /** `className="..."`: the whole attribute initializer is replaced. */
  | 'attribute'
  /** A string literal somewhere inside a class expression. */
  | 'literal'
  /** One quasi of a template literal that also has expressions. */
  | 'quasi'
  /** The initializer, or a property value in the initializer, of a style constant. */
  | 'constant';

export type Site = {
  kind: SiteKind;
  /** Range of the string literal (quotes included), or of the quasi text for `quasi`. */
  start: number;
  end: number;
  text: string;
  tokens: string[];
  /** Whether the literal is a direct argument of a class function, so it can expand to two args. */
  directArg: boolean;
  nameHint: string;
};

/** Class tokens plus references to other class values (`focusRing`, `controlSize.compact`). */
export type ClassParts = { tokens: string[]; refs: string[] };

export type CvaSite = {
  start: number;
  end: number;
  name: string;
  base: ClassParts;
  variants: Array<{ group: string; option: string; parts: ClassParts }>;
  compound: Array<{
    selection: Record<string, string | boolean | Array<string | boolean>>;
    parts: ClassParts;
  }>;
  defaultVariants: string | null;
  /** Something inside was not a plain literal, so this call is reported instead of converted. */
  dynamic: string | null;
};

export type Scan = { sites: Site[]; cva: CvaSite[]; file: ts.SourceFile };

export function parse(fileName: string, text: string): ts.SourceFile {
  return ts.createSourceFile(
    fileName,
    text,
    ts.ScriptTarget.ES2022,
    true,
    fileName.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );
}

export function splitTokens(text: string): string[] {
  return text.split(/\s+/).filter(Boolean);
}

function calleeName(call: ts.CallExpression): string | null {
  const callee = call.expression;
  if (ts.isIdentifier(callee)) return callee.text;
  if (ts.isPropertyAccessExpression(callee)) return callee.name.text;
  return null;
}

function isClassFunctionCall(node: ts.Node): node is ts.CallExpression {
  return ts.isCallExpression(node) && CLASS_FUNCTIONS.has(calleeName(node) ?? '');
}

function isClassNameAttribute(node: ts.Node): node is ts.JsxAttribute {
  return ts.isJsxAttribute(node) && ts.isIdentifier(node.name) && node.name.text === 'className';
}

function isStyleConstant(decl: ts.VariableDeclaration, fileName: string): boolean {
  if (!ts.isIdentifier(decl.name)) return false;
  return CLASS_NAME_PATTERN.test(decl.name.text) || STYLE_FILE_PATTERN.test(fileName);
}

/**
 * Walks up from a literal through the expression forms a class string may be wrapped in.
 * Returns the position it reached: a class attribute, a class function call, a style constant, or
 * nothing.
 */
function classContext(
  literal: ts.Node,
  fileName: string,
): { kind: 'attribute' | 'call' | 'constant'; directArg: boolean } | null {
  let node: ts.Node = literal;
  let directArg = false;
  for (;;) {
    const parent = node.parent;
    if (!parent) return null;
    if (isClassNameAttribute(parent)) return { kind: 'attribute', directArg: false };
    if (ts.isJsxExpression(parent) && parent.parent && isClassNameAttribute(parent.parent)) {
      return { kind: 'attribute', directArg: false };
    }
    if (isClassFunctionCall(parent)) {
      if (calleeName(parent) === 'cva') return null; // cva is handled structurally
      return { kind: 'call', directArg: parent.arguments.includes(node as ts.Expression) };
    }
    if (ts.isVariableDeclaration(parent)) {
      return isStyleConstant(parent, fileName) ? { kind: 'constant', directArg: false } : null;
    }
    if (
      ts.isParenthesizedExpression(parent) ||
      ts.isConditionalExpression(parent) ||
      ts.isTemplateExpression(parent) ||
      ts.isTemplateSpan(parent) ||
      ts.isArrayLiteralExpression(parent) ||
      ts.isAsExpression(parent) ||
      ts.isSatisfiesExpression(parent) ||
      ts.isJsxExpression(parent) ||
      (ts.isBinaryExpression(parent) &&
        [
          ts.SyntaxKind.AmpersandAmpersandToken,
          ts.SyntaxKind.BarBarToken,
          ts.SyntaxKind.QuestionQuestionToken,
        ].includes(parent.operatorToken.kind)) ||
      (ts.isPropertyAssignment(parent) && parent.initializer === node) ||
      ts.isObjectLiteralExpression(parent) ||
      ts.isArrowFunction(parent) ||
      ts.isReturnStatement(parent) ||
      ts.isBlock(parent) ||
      ts.isIfStatement(parent)
    ) {
      directArg = false;
      node = parent;
      continue;
    }
    return null;
  }
}

function enclosingName(node: ts.Node): string {
  for (let n: ts.Node | undefined = node; n; n = n.parent) {
    if ((ts.isFunctionDeclaration(n) || ts.isFunctionExpression(n)) && n.name) return n.name.text;
    if (ts.isMethodDeclaration(n) && ts.isIdentifier(n.name)) return n.name.text;
    if (
      (ts.isArrowFunction(n) || ts.isFunctionExpression(n)) &&
      n.parent &&
      ts.isVariableDeclaration(n.parent) &&
      ts.isIdentifier(n.parent.name)
    ) {
      return n.parent.name.text;
    }
  }
  return '';
}

function enclosingTag(node: ts.Node): string {
  for (let n: ts.Node | undefined = node; n; n = n.parent) {
    if (ts.isJsxOpeningElement(n) || ts.isJsxSelfClosingElement(n)) {
      const tag = n.tagName.getText();
      return tag.includes('.') ? tag.split('.').pop()! : tag;
    }
    if (ts.isFunctionLike(n)) break;
  }
  return '';
}

function propertyKeyHint(node: ts.Node): string {
  const parent = node.parent;
  if (parent && ts.isPropertyAssignment(parent) && parent.initializer === node) {
    return parent.name.getText().replace(/['"]/g, '');
  }
  return '';
}

function constantName(node: ts.Node): string {
  for (let n: ts.Node | undefined = node; n; n = n.parent) {
    if (ts.isVariableDeclaration(n) && ts.isIdentifier(n.name)) return n.name.text;
    if (ts.isFunctionLike(n)) break;
  }
  return '';
}

export function toCamel(parts: string[]): string {
  const words = parts
    .flatMap(p => p.split(/[^A-Za-z0-9]+/))
    .filter(Boolean)
    .map(w => w[0].toUpperCase() + w.slice(1));
  if (!words.length) return 'style';
  const joined = words.join('');
  return joined[0].toLowerCase() + joined.slice(1);
}

function nameHintFor(literal: ts.Node, kind: SiteKind): string {
  if (kind === 'constant') {
    return toCamel([constantName(literal), propertyKeyHint(literal)]);
  }
  const fn = enclosingName(literal);
  const tag = enclosingTag(literal);
  const prop = propertyKeyHint(literal);
  return toCamel([fn, tag || 'class', prop]);
}

function isReference(node: ts.Expression): boolean {
  return (
    ts.isIdentifier(node) || (ts.isPropertyAccessExpression(node) && isReference(node.expression))
  );
}

/**
 * Reads a class value: a string, a template without expressions, a reference to another class
 * value, or an array of those. Order is kept: a reference after a string composes after it.
 */
function classParts(node: ts.Expression): ClassParts | null {
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
    return { tokens: splitTokens(node.text), refs: [] };
  }
  if (isReference(node)) {
    return { tokens: [], refs: [node.getText()] };
  }
  if (ts.isArrayLiteralExpression(node)) {
    const out: ClassParts = { tokens: [], refs: [] };
    for (const el of node.elements) {
      const p = classParts(el);
      if (!p) return null;
      out.tokens.push(...p.tokens);
      out.refs.push(...p.refs);
    }
    return out;
  }
  return null;
}

function readCva(call: ts.CallExpression): CvaSite {
  const name =
    ts.isVariableDeclaration(call.parent) && ts.isIdentifier(call.parent.name)
      ? call.parent.name.text
      : 'variants';
  const site: CvaSite = {
    start: call.getStart(),
    end: call.getEnd(),
    name,
    base: { tokens: [], refs: [] },
    variants: [],
    compound: [],
    defaultVariants: null,
    dynamic: null,
  };
  const [baseArg, configArg] = call.arguments;
  const base = baseArg ? classParts(baseArg) : { tokens: [], refs: [] };
  if (!base) return { ...site, dynamic: 'base is not a class string' };
  site.base = base;
  if (!configArg) return site;
  if (!ts.isObjectLiteralExpression(configArg))
    return { ...site, dynamic: 'config is not an object literal' };

  for (const prop of configArg.properties) {
    if (!ts.isPropertyAssignment(prop))
      return { ...site, dynamic: `config has a ${ts.SyntaxKind[prop.kind]}` };
    const key = prop.name.getText().replace(/['"]/g, '');
    if (key === 'variants') {
      if (!ts.isObjectLiteralExpression(prop.initializer))
        return { ...site, dynamic: 'variants is not an object literal' };
      for (const group of prop.initializer.properties) {
        if (!ts.isPropertyAssignment(group) || !ts.isObjectLiteralExpression(group.initializer)) {
          return { ...site, dynamic: 'a variant group is not an object literal' };
        }
        const groupName = group.name.getText().replace(/['"]/g, '');
        for (const option of group.initializer.properties) {
          if (!ts.isPropertyAssignment(option))
            return { ...site, dynamic: 'a variant option is not a property' };
          const parts = classParts(option.initializer);
          if (!parts)
            return {
              ...site,
              dynamic: `variant ${groupName}.${option.name.getText()} is not a class string`,
            };
          site.variants.push({
            group: groupName,
            option: option.name.getText().replace(/['"]/g, ''),
            parts,
          });
        }
      }
    } else if (key === 'compoundVariants') {
      if (!ts.isArrayLiteralExpression(prop.initializer))
        return { ...site, dynamic: 'compoundVariants is not an array' };
      for (const entry of prop.initializer.elements) {
        if (!ts.isObjectLiteralExpression(entry))
          return { ...site, dynamic: 'a compound variant is not an object' };
        const selection: CvaSite['compound'][number]['selection'] = {};
        let parts: ClassParts = { tokens: [], refs: [] };
        for (const field of entry.properties) {
          if (!ts.isPropertyAssignment(field))
            return { ...site, dynamic: 'a compound field is not a property' };
          const fieldName = field.name.getText().replace(/['"]/g, '');
          if (fieldName === 'class' || fieldName === 'className') {
            const p = classParts(field.initializer);
            if (!p) return { ...site, dynamic: 'a compound class is not a class string' };
            parts = p;
          } else {
            const value = literalValue(field.initializer);
            if (value === undefined)
              return { ...site, dynamic: `compound selection ${fieldName} is not a literal` };
            selection[fieldName] = value;
          }
        }
        site.compound.push({ selection, parts });
      }
    } else if (key === 'defaultVariants') {
      site.defaultVariants = prop.initializer.getText();
    } else {
      return { ...site, dynamic: `unknown cva option ${key}` };
    }
  }
  return site;
}

function literalValue(node: ts.Expression): string | boolean | Array<string | boolean> | undefined {
  if (ts.isStringLiteral(node)) return node.text;
  if (node.kind === ts.SyntaxKind.TrueKeyword) return true;
  if (node.kind === ts.SyntaxKind.FalseKeyword) return false;
  if (ts.isArrayLiteralExpression(node)) {
    const out: Array<string | boolean> = [];
    for (const el of node.elements) {
      const v = literalValue(el);
      if (v === undefined || Array.isArray(v)) return undefined;
      out.push(v);
    }
    return out;
  }
  return undefined;
}

/** Every identifier name in the file, to pick a binding that does not clash. */
export function identifiers(file: ts.SourceFile): Set<string> {
  const out = new Set<string>();
  const visit = (node: ts.Node) => {
    if (ts.isIdentifier(node)) out.add(node.text);
    ts.forEachChild(node, visit);
  };
  visit(file);
  return out;
}

export function scan(fileName: string, text: string): Scan {
  const file = parse(fileName, text);
  const sites: Site[] = [];
  const cva: CvaSite[] = [];

  const visit = (node: ts.Node) => {
    if (ts.isCallExpression(node) && calleeName(node) === 'cva') {
      cva.push(readCva(node));
      return; // its strings are read structurally
    }
    if (
      ts.isImportDeclaration(node) ||
      ts.isTaggedTemplateExpression(node) ||
      ts.isLiteralTypeNode(node)
    ) {
      return;
    }
    if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
      // `className="..."` attribute value, with no braces
      if (node.parent && isClassNameAttribute(node.parent)) {
        sites.push({
          kind: 'attribute',
          start: node.getStart(),
          end: node.getEnd(),
          text: node.text,
          tokens: splitTokens(node.text),
          directArg: false,
          nameHint: nameHintFor(node, 'attribute'),
        });
        return;
      }
      const ctx = classContext(node, fileName);
      if (ctx && splitTokens(node.text).length) {
        const kind: SiteKind = ctx.kind === 'constant' ? 'constant' : 'literal';
        sites.push({
          kind,
          start: node.getStart(),
          end: node.getEnd(),
          text: node.text,
          tokens: splitTokens(node.text),
          directArg: ctx.directArg,
          nameHint: nameHintFor(node, kind),
        });
      }
      return;
    }
    if (ts.isTemplateExpression(node)) {
      const ctx = classContext(node, fileName);
      if (ctx) {
        const quasis: Array<ts.TemplateHead | ts.TemplateMiddle | ts.TemplateTail> = [
          node.head,
          ...node.templateSpans.map(s => s.literal),
        ];
        for (const quasi of quasis) {
          const tokens = splitTokens(quasi.text);
          if (!tokens.length) continue;
          // The quasi's own range excludes the delimiters: ` or } at the start, ${ or ` at the end.
          const raw = quasi.getText();
          const leading = raw.startsWith('`') || raw.startsWith('}') ? 1 : 0;
          const trailing = raw.endsWith('${') ? 2 : raw.endsWith('`') ? 1 : 0;
          sites.push({
            kind: 'quasi',
            start: quasi.getStart() + leading,
            end: quasi.getEnd() - trailing,
            text: quasi.text,
            tokens,
            directArg: false,
            nameHint: nameHintFor(node, ctx.kind === 'constant' ? 'constant' : 'literal'),
          });
        }
        // Expressions inside the template may themselves hold class strings.
        for (const span of node.templateSpans) visit(span.expression);
        return;
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(file);

  return { sites, cva, file };
}
