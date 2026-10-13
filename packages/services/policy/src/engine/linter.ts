// Runs the engine rules the way ESLint 8.57.1's `Linter#verify` ran graphql-eslint 3.20.1, so stored
// policies keep producing the same messages in the same order. Ported pieces are noted inline.
//
// Deliberately not ported:
// - fixes and suggestions: the policy service never applies them, so their callbacks never run.
// - `eslint-disable` and inline config comments: checks lint `print(parse(sdl))`, which drops comments.
import esquery from 'esquery';
import { buildSchema, GraphQLError, GraphQLSchema } from 'graphql';
import { parseGraphQLSDL } from '@graphql-tools/utils';
import { convertToESTree, extractComments, extractTokens } from './estree-converter/index.js';
import { rules } from './rules/index.js';
import type { AST, GraphQLESLintRuleContext, ReportDescriptor, SourceCode } from './types.js';

export type RuleSeverity = 0 | 1 | 2 | 'off' | 'warn' | 'error';

export type RulesConfig = Record<string, RuleSeverity | [RuleSeverity, ...unknown[]]>;

export type LintMessage = {
  ruleId: string | null;
  severity: 1 | 2;
  message: string;
  line: number;
  column: number;
  nodeType?: string | null;
  messageId?: string;
  endLine?: number;
  endColumn?: number;
  fatal?: true;
};

const FILE_PATH = 'schema.graphql';

type Node = { type: string; parent?: Node | null; range: AST.Range; loc: any; [key: string]: any };

export function lint(input: { source: string; schema: string; rules: RulesConfig }): LintMessage[] {
  // ESLint strips a BOM, and turns a leading shebang into a JS line comment for the parser only.
  const text = input.source.replace(/^\uFEFF/, '');

  let parsed: { ast: AST.Program; schema: GraphQLSchema };
  try {
    parsed = parse(
      text.replace(/^#!([^\r\n]+)/u, (_, captured) => `//${captured}`),
      input.schema,
    );
  } catch (error: any) {
    return [
      {
        ruleId: null,
        fatal: true,
        severity: 2,
        message: `Parsing error: ${String(error.message)
          .replace(/^line \d+:/iu, '')
          .trim()}`,
        line: error.lineNumber,
        column: error.column,
        nodeType: null,
      },
    ];
  }

  try {
    return runRules(parsed.ast, parsed.schema, text, input.rules).sort(
      (a, b) => a.line - b.line || a.column - b.column,
    );
  } catch (error: any) {
    error.message += `\nOccurred while linting ${FILE_PATH}`;
    if (error.currentNode) {
      error.message += `:${error.currentNode.loc.start.line}`;
    }
    error.message += `\nRule: "${error.ruleId}"`;
    throw error;
  }
}

// graphql-eslint's parseForESLint, minus graphql-config loading: the schema is always an SDL string.
function parse(code: string, schemaSdl: string): { ast: AST.Program; schema: GraphQLSchema } {
  try {
    const { document } = parseGraphQLSDL(FILE_PATH, code, { noLocation: false });
    let schema: GraphQLSchema;
    try {
      schema = buildSchema(schemaSdl);
    } catch (error) {
      if (error instanceof Error) {
        error.message = `Error while loading schema: ${error.message}`;
      }
      throw error;
    }
    const rootTree = convertToESTree(document, schema);
    return {
      schema,
      ast: {
        comments: extractComments(document.loc),
        tokens: extractTokens(FILE_PATH, code),
        loc: rootTree.loc,
        range: rootTree.range as AST.Range,
        type: 'Program',
        sourceType: 'script',
        body: [rootTree],
      },
    };
  } catch (error) {
    if (error instanceof Error) {
      error.message = `[graphql-eslint] ${error.message}`;
    }
    if (error instanceof GraphQLError) {
      const location = error.locations?.[0];
      throw {
        index: error.positions?.[0],
        ...(location && { lineNumber: location.line, column: location.column - 1 }),
        message: error.message,
      };
    }
    throw error;
  }
}

function getRuleSeverity(ruleConfig: RulesConfig[string]): 0 | 1 | 2 {
  const value = Array.isArray(ruleConfig) ? ruleConfig[0] : ruleConfig;
  if (value === 0 || value === 1 || value === 2) {
    return value;
  }
  if (typeof value === 'string') {
    return ({ off: 0, warn: 1, error: 2 } as const)[value.toLowerCase() as 'off'] ?? 0;
  }
  return 0;
}

// ESLint's `runRules`: queue every enter/leave, register each enabled rule's listeners in config
// order, then replay the queue through the selector dispatcher.
function runRules(
  ast: AST.Program,
  schema: GraphQLSchema,
  text: string,
  config: RulesConfig,
): LintMessage[] {
  const nodeQueue: Array<{ isEntering: boolean; node: Node }> = [];
  traverse(ast as unknown as Node, {
    enter(node, parent) {
      node.parent = parent;
      nodeQueue.push({ isEntering: true, node });
    },
    leave(node) {
      nodeQueue.push({ isEntering: false, node });
    },
  });

  const sourceCode = createSourceCode(text, ast);
  const listeners = new Map<string, Array<(node: Node) => void>>();
  const problems: LintMessage[] = [];

  for (const ruleId of Object.keys(config)) {
    const severity = getRuleSeverity(config[ruleId]);
    if (severity === 0) {
      continue;
    }
    const rule = (rules as Record<string, (typeof rules)[keyof typeof rules]>)[ruleId];
    if (!rule) {
      problems.push({
        ruleId,
        message: `Definition for rule '${ruleId}' was not found.`,
        line: 1,
        column: 1,
        endLine: 1,
        endColumn: 2,
        severity: 2,
        nodeType: null,
      });
      continue;
    }

    const ruleConfig = config[ruleId];
    const context: GraphQLESLintRuleContext = {
      id: ruleId,
      options: Array.isArray(ruleConfig) ? ruleConfig.slice(1) : [],
      parserServices: { schema },
      getSourceCode: () => sourceCode,
      report(descriptor) {
        problems.push(translateReport(ruleId, severity, rule.meta.messages, descriptor));
      },
    };

    let ruleListeners: Record<string, (node: any) => void>;
    try {
      ruleListeners = rule.create(context as any);
    } catch (error: any) {
      error.message = `Error while loading rule '${ruleId}': ${error.message}`;
      throw error;
    }

    for (const selector of Object.keys(ruleListeners)) {
      const listener = ruleListeners[selector];
      const handlers = listeners.get(selector) ?? [];
      handlers.push(node => {
        try {
          listener(node);
        } catch (error: any) {
          error.ruleId = ruleId;
          throw error;
        }
      });
      listeners.set(selector, handlers);
    }
  }

  const generator = new NodeEventGenerator(listeners);
  for (const { isEntering, node } of nodeQueue) {
    try {
      if (isEntering) {
        generator.enterNode(node);
      } else {
        generator.leaveNode(node);
      }
    } catch (error: any) {
      error.currentNode = node;
      throw error;
    }
  }

  return problems;
}

// ESLint's report translator, without fixes and suggestions.
function translateReport(
  ruleId: string,
  severity: 1 | 2,
  messages: Record<string, string> | undefined,
  descriptor: ReportDescriptor,
): LintMessage {
  let message: string;
  if ('messageId' in descriptor && descriptor.messageId) {
    if (!messages || !Object.prototype.hasOwnProperty.call(messages, descriptor.messageId)) {
      throw new TypeError(
        `context.report() called with a messageId of '${descriptor.messageId}' which is not present in the 'messages' config: ${JSON.stringify(messages, null, 2)}`,
      );
    }
    message = messages[descriptor.messageId];
  } else if ('message' in descriptor && descriptor.message) {
    message = descriptor.message;
  } else {
    throw new TypeError(
      'Missing `message` property in report() call; add a message that describes the linting problem.',
    );
  }

  const node = 'node' in descriptor ? (descriptor.node as Node | undefined) : undefined;
  const loc =
    'loc' in descriptor && descriptor.loc
      ? 'start' in descriptor.loc
        ? descriptor.loc
        : { start: descriptor.loc, end: null }
      : node!.loc;

  const problem: LintMessage = {
    ruleId,
    severity,
    message: interpolate(message, descriptor.data),
    line: loc.start.line,
    column: loc.start.column + 1,
    nodeType: node?.type || null,
  };
  if ('messageId' in descriptor && descriptor.messageId) {
    problem.messageId = descriptor.messageId;
  }
  if (loc.end) {
    problem.endLine = loc.end.line;
    problem.endColumn = loc.end.column + 1;
  }
  return problem;
}

function interpolate(text: string, data: Record<string, string> | undefined): string {
  if (!data) {
    return text;
  }
  return text.replace(/\{\{([^{}]+?)\}\}/gu, (fullMatch, termWithWhitespace: string) => {
    const term = termWithWhitespace.trim();
    return term in data ? data[term] : fullMatch;
  });
}

function createSourceCode(text: string, ast: AST.Program): SourceCode {
  const onlyInFixes = (name: string) => () => {
    throw new Error(`sourceCode.${name} is only used by fixes, which the policy engine never runs`);
  };
  return {
    text,
    ast,
    getText(node) {
      if (!node) {
        return text;
      }
      const range = (node as { range: AST.Range }).range;
      return text.slice(Math.max(range[0], 0), range[1]);
    },
    getCommentsBefore: onlyInFixes('getCommentsBefore'),
    getCommentsAfter: onlyInFixes('getCommentsAfter'),
    getTokenBefore: onlyInFixes('getTokenBefore'),
    // ESLint's SourceCode#getNodeByRangeIndex: the deepest node whose range contains the index.
    getNodeByRangeIndex(index) {
      let result: Node | null = null;
      traverse(ast as unknown as Node, {
        enter(node) {
          if (node.range[0] <= index && index < node.range[1]) {
            result = node;
            return;
          }
          return 'skip';
        },
        leave(node) {
          return node === result ? 'break' : undefined;
        },
      });
      return result;
    },
  };
}

// eslint-visitor-keys only knows JS node types; GraphQL nodes fall back to their own keys.
const VISITOR_KEYS: Record<string, string[]> = { Program: ['body'] };
const KEY_BLACKLIST = new Set(['parent', 'leadingComments', 'trailingComments']);

function getKeys(node: object): string[] {
  return Object.keys(node).filter(key => !KEY_BLACKLIST.has(key) && key[0] !== '_');
}

function isNode(value: unknown): value is Node {
  return value !== null && typeof value === 'object' && typeof (value as Node).type === 'string';
}

// ESLint's Traverser. `enter` can return 'skip' and either callback can return 'break'.
function traverse(
  root: Node,
  visitor: {
    enter(node: Node, parent: Node | null): 'skip' | 'break' | void;
    leave(node: Node, parent: Node | null): 'break' | void;
  },
): void {
  let broken = false;
  const visit = (node: unknown, parent: Node | null) => {
    if (!isNode(node)) {
      return;
    }
    const action = visitor.enter(node, parent);
    if (action === 'break') {
      broken = true;
    }
    if (action !== 'skip' && !broken) {
      const keys = VISITOR_KEYS[node.type] ?? getKeys(node);
      for (let i = 0; i < keys.length && !broken; i++) {
        const child = node[keys[i]];
        if (Array.isArray(child)) {
          for (let j = 0; j < child.length && !broken; j++) {
            visit(child[j], node);
          }
        } else {
          visit(child, node);
        }
      }
    }
    if (!broken && visitor.leave(node, parent) === 'break') {
      broken = true;
    }
  };
  visit(root, null);
}

type ParsedSelector = {
  rawSelector: string;
  parsedSelector: esquery.Selector;
  listenerTypes: string[] | null;
  attributeCount: number;
  identifierCount: number;
};

const ESQUERY_OPTIONS = { visitorKeys: VISITOR_KEYS, fallback: getKeys };

const selectorCache = new Map<string, ParsedSelector>();

// Ported from ESLint's node-event-generator.js. The rules use no `:exit` selectors.
function parseSelector(rawSelector: string): ParsedSelector {
  let selector = selectorCache.get(rawSelector);
  if (!selector) {
    const parsedSelector = esquery.parse(rawSelector);
    selector = {
      rawSelector,
      parsedSelector,
      listenerTypes: getPossibleTypes(parsedSelector),
      attributeCount: countClassAttributes(parsedSelector),
      identifierCount: countIdentifiers(parsedSelector),
    };
    selectorCache.set(rawSelector, selector);
  }
  return selector;
}

function getPossibleTypes(selector: any): string[] | null {
  switch (selector.type) {
    case 'identifier':
      return [selector.value];
    case 'matches': {
      const typesForComponents: Array<string[] | null> = selector.selectors.map(getPossibleTypes);
      return typesForComponents.every(Boolean)
        ? [...new Set(typesForComponents.flat() as string[])]
        : null;
    }
    case 'compound': {
      const typesForComponents: string[][] = selector.selectors
        .map(getPossibleTypes)
        .filter(Boolean);
      if (!typesForComponents.length) {
        return null;
      }
      let result = [...new Set(typesForComponents[0])];
      for (const types of typesForComponents.slice(1)) {
        result = result.filter(type => types.includes(type));
      }
      return result;
    }
    case 'child':
    case 'descendant':
    case 'sibling':
    case 'adjacent':
      return getPossibleTypes(selector.right);
    case 'class':
      return selector.name === 'function'
        ? ['FunctionDeclaration', 'FunctionExpression', 'ArrowFunctionExpression']
        : null;
    default:
      return null;
  }
}

function countClassAttributes(selector: any): number {
  switch (selector.type) {
    case 'child':
    case 'descendant':
    case 'sibling':
    case 'adjacent':
      return countClassAttributes(selector.left) + countClassAttributes(selector.right);
    case 'compound':
    case 'not':
    case 'matches':
      return selector.selectors.reduce((sum: number, s: any) => sum + countClassAttributes(s), 0);
    case 'attribute':
    case 'field':
    case 'nth-child':
    case 'nth-last-child':
      return 1;
    default:
      return 0;
  }
}

function countIdentifiers(selector: any): number {
  switch (selector.type) {
    case 'child':
    case 'descendant':
    case 'sibling':
    case 'adjacent':
      return countIdentifiers(selector.left) + countIdentifiers(selector.right);
    case 'compound':
    case 'not':
    case 'matches':
      return selector.selectors.reduce((sum: number, s: any) => sum + countIdentifiers(s), 0);
    case 'identifier':
      return 1;
    default:
      return 0;
  }
}

function compareSpecificity(a: ParsedSelector, b: ParsedSelector): number {
  return (
    a.attributeCount - b.attributeCount ||
    a.identifierCount - b.identifierCount ||
    (a.rawSelector <= b.rawSelector ? -1 : 1)
  );
}

class NodeEventGenerator {
  private currentAncestry: Node[] = [];
  private selectorsByNodeType = new Map<string, ParsedSelector[]>();
  private anyTypeSelectors: ParsedSelector[] = [];

  constructor(private listeners: Map<string, Array<(node: Node) => void>>) {
    for (const rawSelector of listeners.keys()) {
      const selector = parseSelector(rawSelector);
      if (selector.listenerTypes) {
        for (const nodeType of selector.listenerTypes) {
          const list = this.selectorsByNodeType.get(nodeType) ?? [];
          list.push(selector);
          this.selectorsByNodeType.set(nodeType, list);
        }
      } else {
        this.anyTypeSelectors.push(selector);
      }
    }
    this.anyTypeSelectors.sort(compareSpecificity);
    this.selectorsByNodeType.forEach(list => list.sort(compareSpecificity));
  }

  enterNode(node: Node) {
    if (node.parent) {
      this.currentAncestry.unshift(node.parent);
    }
    const byType = this.selectorsByNodeType.get(node.type) ?? [];
    let typeIndex = 0;
    let anyIndex = 0;
    while (typeIndex < byType.length || anyIndex < this.anyTypeSelectors.length) {
      if (
        typeIndex >= byType.length ||
        (anyIndex < this.anyTypeSelectors.length &&
          compareSpecificity(this.anyTypeSelectors[anyIndex], byType[typeIndex]) < 0)
      ) {
        this.applySelector(node, this.anyTypeSelectors[anyIndex++]);
      } else {
        this.applySelector(node, byType[typeIndex++]);
      }
    }
  }

  leaveNode(_node: Node) {
    this.currentAncestry.shift();
  }

  private applySelector(node: Node, selector: ParsedSelector) {
    if (
      esquery.matches(
        node as any,
        selector.parsedSelector,
        this.currentAncestry as any[],
        ESQUERY_OPTIONS as any,
      )
    ) {
      for (const listener of this.listeners.get(selector.rawSelector)!) {
        listener(node);
      }
    }
  }
}
