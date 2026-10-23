import { graphqlSyntaxMarkers } from './graphql-syntax-markers';

describe('graphqlSyntaxMarkers', () => {
  it('returns nothing for SDL that parses', () => {
    expect(graphqlSyntaxMarkers('type Query { a: String }')).toEqual([]);
    expect(graphqlSyntaxMarkers('extend type Query { hello: String }')).toEqual([]);
  });

  it('returns nothing for a blank document, which graphql itself refuses to parse', () => {
    expect(graphqlSyntaxMarkers('')).toEqual([]);
    expect(graphqlSyntaxMarkers('   \n  ')).toEqual([]);
  });

  it('marks the token graphql choked on with its message', () => {
    expect(graphqlSyntaxMarkers('extend type Query { a: }')).toEqual([
      {
        startLineNumber: 1,
        startColumn: 24,
        endLineNumber: 1,
        endColumn: 25,
        message: 'Syntax Error: Expected Name, found "}".',
        severity: 8,
      },
    ]);
  });

  it('marks the line the error is on in a multi-line document', () => {
    expect(graphqlSyntaxMarkers('type Query {\n  a: String\n  b:\n}')).toMatchObject([
      { startLineNumber: 4, startColumn: 1, endLineNumber: 4, endColumn: 2 },
    ]);
  });
});
