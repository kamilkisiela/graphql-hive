import { sortSdl } from './sort-sdl';

describe('sortSdl', () => {
  it('sorts definitions by kind and name, schema and directive definitions first', () => {
    const sorted = sortSdl(/* GraphQL */ `
      type Zebra {
        id: ID
      }
      enum Color {
        RED
      }
      directive @tag(name: String) on FIELD_DEFINITION
      type Apple {
        id: ID
      }
      schema {
        query: Zebra
      }
    `);

    expect(sorted).toBe(
      [
        'schema {\n  query: Zebra\n}',
        'directive @tag(name: String) on FIELD_DEFINITION',
        'enum Color {\n  RED\n}',
        'type Apple {\n  id: ID\n}',
        'type Zebra {\n  id: ID\n}',
      ].join('\n\n'),
    );
  });

  it('sorts fields, arguments, interfaces, union members and enum values', () => {
    const sorted = sortSdl(/* GraphQL */ `
      type Query implements Node & Entity {
        zed(b: Int, a: Int): Int
        alpha: Int
      }
      union Result = Query | Error
      enum Size {
        SMALL
        LARGE
      }
      input Filter {
        to: Int
        from: Int
      }
    `);

    expect(sorted).toContain(
      'type Query implements Entity & Node {\n  alpha: Int\n  zed(a: Int, b: Int): Int\n}',
    );
    expect(sorted).toContain('union Result = Error | Query');
    expect(sorted).toContain('enum Size {\n  LARGE\n  SMALL\n}');
    expect(sorted).toContain('input Filter {\n  from: Int\n  to: Int\n}');
  });

  it('keeps descriptions with their nodes', () => {
    const sorted = sortSdl(/* GraphQL */ `
      type Query {
        "Second"
        b: Int
        "First"
        a: Int
      }
    `);

    expect(sorted).toBe('type Query {\n  "First"\n  a: Int\n  "Second"\n  b: Int\n}');
  });

  it('keeps repeated directives in their original order', () => {
    const sorted = sortSdl(/* GraphQL */ `
      type User @key(fields: "id") @join__type(graph: B) @join__type(graph: A) {
        id: ID
      }
    `);

    expect(sorted).toContain('@join__type(graph: B) @join__type(graph: A) @key(fields: "id")');
  });

  it('leaves list default values in order', () => {
    const sorted = sortSdl('type Query { items(order: [String] = ["z", "a"]): Int }');

    expect(sorted).toContain('["z", "a"]');
  });

  it('prints two orderings of the same schema identically', () => {
    const a = 'type B { y: Int x: Int }\ntype A { id: ID }\nscalar Date';
    const b = 'scalar Date\ntype A { id: ID }\ntype B { x: Int y: Int }';

    expect(sortSdl(a)).toBe(sortSdl(b));
  });

  it('is idempotent', () => {
    const once = sortSdl('type B { y: Int x: Int }\ntype A { id: ID }');

    expect(sortSdl(once)).toBe(once);
  });

  it('returns input that does not parse unchanged', () => {
    const invalid = 'type Query {';

    expect(sortSdl(invalid)).toBe(invalid);
  });
});
