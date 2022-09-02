import { Plugin } from '@envelop/types';
import { GraphQLError, Source, TokenKind } from 'graphql';
import { ParseOptions, Parser } from 'graphql/language/parser';

type ParserWithLexerOptions = ParseOptions & {
  tokenLimit: number;
};

class ParserWithLexer extends Parser {
  private __tokenCount = 0;

  get tokenCount() {
    return this.__tokenCount;
  }

  constructor(source: string | Source, options: ParserWithLexerOptions) {
    super(source, options);
    const lexer = this._lexer;
    this._lexer = new Proxy(lexer, {
      get: (target, prop, receiver) => {
        if (prop === 'advance') {
          return () => {
            const token = target.advance();
            if (token.kind !== TokenKind.EOF) {
              this.__tokenCount++;
            }
            if (this.__tokenCount > options.tokenLimit) {
              throw new GraphQLError(`Syntax Error: Token limit of ${options.tokenLimit} exceeded.`, {
                source: this._lexer.source,
                positions: [token.start],
              });
            }
            return token;
          };
        }
        return Reflect.get(target, prop, receiver);
      },
    });
  }
}

/**
 * Limit the maximum amount of tokens allowed within a GraphQL document.
 */
export function useTokenLimit(args: { tokenLimit: number }): Plugin {
  function parseWithTokenLimit(source: string | Source, options?: ParseOptions) {
    const parser = new ParserWithLexer(source, { ...options, tokenLimit: args.tokenLimit });
    return parser.parseDocument();
  }
  return {
    onParse({ setParseFn }) {
      setParseFn(parseWithTokenLimit);
    },
  };
}
