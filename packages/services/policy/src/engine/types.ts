// Local stand-ins for the ESLint and ESTree types the engine rules were written against, so the
// engine runs without either package. Shapes match ESLint 8 where the rules depend on them.
import { ASTKindToNode, GraphQLSchema } from 'graphql';
import { JSONSchema } from 'json-schema-to-ts';
import type { GraphQLESTreeNode } from './estree-converter/index.js';

export type Position = { line: number; column: number };

export type SourceLocation = { start: Position; end: Position };

export type Comment = {
  type: 'Block' | 'Line';
  value: string;
  loc?: SourceLocation | null;
  range?: [number, number];
};

export declare namespace AST {
  type Range = [number, number];
  type SourceLocation = import('./types.js').SourceLocation;
  type Token = { type: string; value: string; loc: SourceLocation; range: Range };
  type Program = {
    type: 'Program';
    body: any[];
    sourceType: 'script';
    comments: Comment[];
    tokens: Token[];
    loc: SourceLocation;
    range: Range;
  };
}

type Ranged = { range?: AST.Range } | { loc?: SourceLocation | null };

export type Fix = { range: AST.Range; text: string };

export type RuleFixer = {
  remove(nodeOrToken: Ranged): Fix;
  replaceText(nodeOrToken: Ranged, text: string): Fix;
  replaceTextRange(range: AST.Range, text: string): Fix;
};

export type SourceCode = {
  text: string;
  ast: AST.Program;
  getText(node?: Ranged): string;
  getCommentsBefore(nodeOrToken: Ranged): Comment[];
  getCommentsAfter(nodeOrToken: Ranged): Comment[];
  getTokenBefore(nodeOrToken: Ranged | Comment, options?: { includeComments?: boolean }): any;
  getNodeByRangeIndex(index: number): any;
};

export type Schema = GraphQLSchema | null;

export type ParserServices = {
  schema: Schema;
};

type Location = SourceLocation | Position;

type ReportDescriptorLocation = { loc: Location } | { node: { loc: Location } };

type ReportDescriptorMessage = { message: string } | { messageId: string };

type ReportDescriptorOptions = {
  data?: Record<string, string>;
  fix?: ((fixer: RuleFixer) => Fix | Iterable<Fix> | null) | null;
  suggest?: Array<
    ({ desc: string } | { messageId: string }) & {
      data?: Record<string, string>;
      fix: (fixer: RuleFixer) => Fix | Iterable<Fix> | null;
    }
  > | null;
};

export type ReportDescriptor = ReportDescriptorLocation &
  ReportDescriptorMessage &
  ReportDescriptorOptions;

export type GraphQLESLintRuleContext<Options = any[]> = {
  id: string;
  options: Options;
  parserServices: ParserServices;
  report(descriptor: ReportDescriptor): void;
  getSourceCode(): SourceCode;
};

export type GraphQLESLintRuleListener<WithTypeInfo extends boolean = false> = Record<
  string,
  any
> & {
  [K in keyof ASTKindToNode]?: (node: GraphQLESTreeNode<ASTKindToNode[K], WithTypeInfo>) => void;
};

export type CategoryType = 'Operations' | 'Schema';

export type RuleDocsInfo<T> = {
  description?: string;
  recommended?: boolean;
  url?: string;
  category: CategoryType | CategoryType[];
  requiresSchema?: true;
  requiresSiblings?: true;
  examples?: {
    title: string;
    code: string;
    usage?: T;
  }[];
  configOptions?:
    | T
    | {
        schema?: T;
        operations?: T;
      };
  graphQLJSRuleName?: string;
  isDisabledForAllConfig?: true;
};

export type GraphQLESLintRule<Options = [], WithTypeInfo extends boolean = false> = {
  meta: {
    type?: 'problem' | 'suggestion' | 'layout';
    docs?: RuleDocsInfo<Options>;
    messages?: Record<string, string>;
    fixable?: 'code' | 'whitespace';
    hasSuggestions?: boolean;
    deprecated?: boolean;
    replacedBy?: string[];
    schema: Readonly<JSONSchema> | [];
  };
  create(context: GraphQLESLintRuleContext<Options>): GraphQLESLintRuleListener<WithTypeInfo>;
};

export type ValueOf<T> = T[keyof T];

type Id<T> = { [P in keyof T]: T[P] } & {};

type OmitDistributive<T, K extends PropertyKey> = T extends object ? Id<OmitRecursively<T, K>> : T;
export type OmitRecursively<T extends object, K extends PropertyKey> = Omit<
  { [P in keyof T]: OmitDistributive<T[P], K> },
  K
>;
