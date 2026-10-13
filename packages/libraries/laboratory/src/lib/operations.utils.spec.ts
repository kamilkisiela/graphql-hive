import { buildSchema, parse } from 'graphql';
import {
  addArgToField,
  addPathToQuery,
  buildForcedOpenPathSet,
  buildVisiblePathSet,
  createSchemaPathSearchIndex,
  deletePathFromQuery,
  extractPaths,
  getFieldByPath,
  getOpenPaths,
  getOperationName,
  getOperationType,
  handleTemplate,
  healQuery,
  isArgInQuery,
  isPathInQuery,
  mergeHeaders,
  mergeOpenPaths,
  pathsToStrings,
  removeArgFromField,
  schemaToPaths,
  searchSchemaPathIndex,
  searchSchemaPaths,
} from './operations.utils';

describe('handleTemplate', () => {
  it('substitutes a variable embedded in surrounding text', () => {
    expect(handleTemplate('Bearer {{token}}', { token: 'abc' })).toBe('Bearer abc');
  });

  it('substitutes multiple variables', () => {
    expect(handleTemplate('{{a}}-{{b}}', { a: '1', b: '2' })).toBe('1-2');
  });

  it('resolves dotted lodash paths', () => {
    expect(handleTemplate('{{auth.token}}', { auth: { token: 'xyz' } })).toBe('xyz');
  });

  it('leaves the literal placeholder when the variable is missing', () => {
    expect(handleTemplate('{{missing}}', {})).toBe('{{missing}}');
  });

  it('leaves text without placeholders untouched', () => {
    expect(handleTemplate('plain text', { name: 'Bob' })).toBe('plain text');
  });

  it('substitutes falsy-but-defined values like 0', () => {
    expect(handleTemplate('{{count}}', { count: 0 })).toBe('0');
  });

  it('falls back to the literal for null values (nullish, not falsy)', () => {
    expect(handleTemplate('{{x}}', { x: null })).toBe('{{x}}');
  });

  it('is whitespace-sensitive: inner spaces are part of the lookup key and do not resolve', () => {
    expect(handleTemplate('{{ name }}', { name: 'Bob' })).toBe('{{ name }}');
  });
});

describe('mergeHeaders', () => {
  it('lets the override replace a base header of the same name', () => {
    expect(mergeHeaders({ authorization: 'old' }, { authorization: 'new' })).toEqual({
      authorization: 'new',
    });
  });

  it('compares names case-insensitively', () => {
    expect(mergeHeaders({ Authorization: 'old' }, { authorization: 'new' })).toEqual({
      authorization: 'new',
    });
  });

  it('keeps base headers the override does not name', () => {
    expect(mergeHeaders({ 'x-op': 'mine', accept: '*/*' }, { 'x-trace': 't' })).toEqual({
      'x-op': 'mine',
      accept: '*/*',
      'x-trace': 't',
    });
  });

  it('returns the base when there is nothing to override', () => {
    expect(mergeHeaders({ 'x-op': 'mine' }, {})).toEqual({ 'x-op': 'mine' });
  });
});

describe('getOperationName', () => {
  it('reads the name of a named operation', () => {
    expect(getOperationName('query Foo { a }')).toBe('Foo');
  });

  it('returns undefined for an anonymous operation', () => {
    expect(getOperationName('{ a }')).toBeUndefined();
  });

  it('falls back to a regex when the query does not parse', () => {
    expect(getOperationName('query Broken { a ')).toBe('Broken');
  });
});

describe('getOperationType', () => {
  it('detects query, mutation and subscription', () => {
    expect(getOperationType('query Q { a }')).toBe('query');
    expect(getOperationType('mutation M { a }')).toBe('mutation');
    expect(getOperationType('subscription S { a }')).toBe('subscription');
  });

  it('defaults an anonymous shorthand to query', () => {
    expect(getOperationType('{ a }')).toBe('query');
  });

  it('returns null for an unparseable query', () => {
    expect(getOperationType('not a query {')).toBeNull();
  });
});

describe('healQuery', () => {
  it('strips empty selection sets', () => {
    expect(healQuery('query Foo {}')).toBe('query Foo ');
    expect(healQuery('query Foo { }')).toBe('query Foo ');
  });

  it('leaves non-empty selection sets intact', () => {
    expect(healQuery('query Foo { a }')).toBe('query Foo { a }');
  });
});

describe('isPathInQuery', () => {
  const query = 'query { user { name } }';

  it('finds a leaf path', () => {
    expect(isPathInQuery(query, 'query.user.name')).toBe(true);
  });

  it('finds an intermediate path', () => {
    expect(isPathInQuery(query, 'query.user')).toBe(true);
  });

  it('returns false for a missing path', () => {
    expect(isPathInQuery(query, 'query.user.email')).toBe(false);
  });

  it('returns true for the bare operation with no segments', () => {
    expect(isPathInQuery(query, 'query')).toBe(true);
  });

  it('returns false for empty inputs', () => {
    expect(isPathInQuery('', 'query.user')).toBe(false);
    expect(isPathInQuery(query, '')).toBe(false);
  });
});

describe('isArgInQuery', () => {
  const query = 'query { user(id: 1) { name } }';

  it('detects an argument present on a field', () => {
    expect(isArgInQuery(query, 'query.user', 'id')).toBe(true);
  });

  it('returns false for an absent argument', () => {
    expect(isArgInQuery(query, 'query.user', 'limit')).toBe(false);
  });
});

describe('extractPaths / getOpenPaths', () => {
  it('lists every field path including the root operation', () => {
    expect(getOpenPaths('query { user { name } }')).toEqual([
      'query',
      'query.user',
      'query.user.name',
    ]);
  });

  it('returns an empty list for an unparseable query', () => {
    expect(extractPaths('not valid {')).toEqual([]);
  });
});

describe('addPathToQuery / deletePathFromQuery', () => {
  it('adds a nested path to an empty query and it round-trips as present', () => {
    const result = addPathToQuery('', 'query.user.name');
    expect(isPathInQuery(result, 'query.user.name')).toBe(true);
  });

  it('adds a sibling field without dropping the existing one', () => {
    const result = addPathToQuery('query { user { id } }', 'query.user.name');
    expect(isPathInQuery(result, 'query.user.id')).toBe(true);
    expect(isPathInQuery(result, 'query.user.name')).toBe(true);
  });

  it('deletes a leaf field while leaving its sibling intact', () => {
    const result = deletePathFromQuery('query { user { id name } }', 'query.user.name');
    expect(isPathInQuery(result, 'query.user.name')).toBe(false);
    expect(isPathInQuery(result, 'query.user.id')).toBe(true);
  });

  // The walk is anchored at the operation root, so the same field name at two
  // depths addresses two different selections.
  it('does not confuse the same field name at a different depth', () => {
    const query = 'query { user { name } }';

    expect(isPathInQuery(query, 'query.name')).toBe(false);
    expect(isPathInQuery(addPathToQuery(query, 'query.name'), 'query.user.name')).toBe(true);
  });
});

describe('inline fragments in the document', () => {
  const IMAGE = 'query.page.content.on:Image.url';
  const VIDEO = 'query.page.content.on:Video.url';

  it('writes a type condition as an inline fragment and round-trips it', () => {
    const result = addPathToQuery('', IMAGE);

    expect(result).toContain('... on Image');
    expect(isPathInQuery(result, IMAGE)).toBe(true);
    expect(() => parse(result)).not.toThrow();
  });

  // Both members declare `url`. Without the type condition in the path the two
  // selections are indistinguishable, which is the whole reason it exists.
  it('keeps identically named fields in different members apart', () => {
    const onlyImage = addPathToQuery('', IMAGE);

    expect(isPathInQuery(onlyImage, IMAGE)).toBe(true);
    expect(isPathInQuery(onlyImage, VIDEO)).toBe(false);

    const both = addPathToQuery(onlyImage, VIDEO);

    expect(isPathInQuery(both, IMAGE)).toBe(true);
    expect(isPathInQuery(both, VIDEO)).toBe(true);
    expect(both.match(/\.\.\. on /g)).toHaveLength(2);
  });

  it('reuses an existing fragment rather than adding a second one', () => {
    const result = addPathToQuery(addPathToQuery('', IMAGE), 'query.page.content.on:Image.title');

    expect(result.match(/\.\.\. on Image/g)).toHaveLength(1);
    expect(isPathInQuery(result, IMAGE)).toBe(true);
    expect(isPathInQuery(result, 'query.page.content.on:Image.title')).toBe(true);
  });

  // A field appended beside the fragment instead of inside it is invalid on a
  // union, which is what the old prefix-matching insert produced.
  it('inserts into a parent whose selections are only fragments', () => {
    const result = addPathToQuery(addPathToQuery('', IMAGE), VIDEO);

    expect(() => parse(result)).not.toThrow();
    expect(result).not.toMatch(/\}\s*url/);
  });

  // An emptied fragment prints as `... on X` with no braces, which is a syntax
  // error, and every walker swallows a parse failure and stops working.
  it('removes a fragment left empty by its last field', () => {
    const both = addPathToQuery(addPathToQuery('', IMAGE), VIDEO);
    const result = deletePathFromQuery(both, IMAGE);

    expect(() => parse(result)).not.toThrow();
    expect(result).not.toContain('... on Image');
    expect(isPathInQuery(result, VIDEO)).toBe(true);
  });

  it('keeps a fragment that still has other fields', () => {
    const withBoth = addPathToQuery(addPathToQuery('', IMAGE), 'query.page.content.on:Image.title');
    const result = deletePathFromQuery(withBoth, IMAGE);

    expect(result).toContain('... on Image');
    expect(isPathInQuery(result, 'query.page.content.on:Image.title')).toBe(true);
  });

  it('reports fragment paths so a loaded document expands them', () => {
    const paths = getOpenPaths('query { page { content { ... on Image { url } } } }');

    expect(paths).toContain('query.page.content');
    expect(paths).toContain('query.page.content.on:Image');
    expect(paths).toContain(IMAGE);
  });

  it('treats a fragment with no type condition as transparent', () => {
    const query = 'query { page { content { ... @include(if: $x) { url } } } }';

    expect(getOpenPaths(query)).toContain('query.page.content.url');
    expect(isPathInQuery(query, 'query.page.content.url')).toBe(true);
  });

  it('leaves a named fragment spread alone', () => {
    const query = 'query { page { content { ...Fields } } }';

    expect(isPathInQuery(query, 'query.page.content.url')).toBe(false);
    expect(deletePathFromQuery(query, 'query.page.content.url')).toContain('...Fields');
    expect(addPathToQuery(query, 'query.page.title')).toContain('...Fields');
  });

  it('does not confuse a fragment path for the parent-level field of the same name', () => {
    const both = addPathToQuery(addPathToQuery('', IMAGE), VIDEO);

    expect(isPathInQuery(both, 'query.page.content.url')).toBe(false);
  });

  it('adds and removes an argument on a field inside a fragment', () => {
    const schema = buildSchema(/* GraphQL */ `
      type Image {
        url(size: Int): String
      }
      union Content = Image
      type Page {
        content: [Content!]!
      }
      type Query {
        page: Page
      }
    `);

    const withArg = addArgToField(addPathToQuery('', IMAGE), IMAGE, 'size', schema);

    expect(isArgInQuery(withArg, IMAGE, 'size')).toBe(true);
    expect(isArgInQuery(removeArgFromField(withArg, IMAGE, 'size'), IMAGE, 'size')).toBe(false);
  });
});

describe('addArgToField / removeArgFromField', () => {
  const schema = buildSchema(/* GraphQL */ `
    type Query {
      a(id: ID!): User
      b(id: ID!): User
      posts: [Post!]!
    }
    type Post {
      author(verified: Boolean): User
    }
    type User {
      id: ID!
      name: String!
    }
  `);

  it('adds an argument (and its variable) to a field', () => {
    const result = addArgToField('query { a { id } }', 'query.a', 'id', schema);
    expect(isArgInQuery(result, 'query.a', 'id')).toBe(true);
  });

  it('generates a unique variable name when the same arg name is reused', () => {
    const withA = addArgToField('query { a { id } b { id } }', 'query.a', 'id', schema);
    const withBoth = addArgToField(withA, 'query.b', 'id', schema);
    expect(isArgInQuery(withBoth, 'query.a', 'id')).toBe(true);
    expect(isArgInQuery(withBoth, 'query.b', 'id')).toBe(true);
    expect(withBoth).toContain('$id2');
  });

  it('removes an argument from a field', () => {
    const withArg = addArgToField('query { a { id } }', 'query.a', 'id', schema);
    const removed = removeArgFromField(withArg, 'query.a', 'id');
    expect(isArgInQuery(removed, 'query.a', 'id')).toBe(false);
  });

  // Resolving the arg means walking the path back to its field in the schema,
  // which for a nested path has to see through the list wrapper on `posts`.
  it('adds an argument to a nested field reached through a list', () => {
    const result = addArgToField(
      'query { posts { author { id } } }',
      'query.posts.author',
      'verified',
      schema,
    );

    expect(isArgInQuery(result, 'query.posts.author', 'verified')).toBe(true);

    const removed = removeArgFromField(result, 'query.posts.author', 'verified');

    expect(isArgInQuery(removed, 'query.posts.author', 'verified')).toBe(false);
  });
});

describe('__typename on abstract fields', () => {
  const schema = buildSchema(/* GraphQL */ `
    type Image {
      url: String
    }
    type Video {
      url: String
    }
    union CmsContent = Image | Video
    interface Node {
      id: ID!
    }
    type Page {
      content: [CmsContent!]!
      node: Node
      meta: Meta
    }
    type Meta {
      title: String
    }
    type Query {
      categoryPage: Page
    }
  `);

  // The reported bug: the builder wrote `content` with no selection set, and the
  // customer's server rejected the operation with a 400.
  it('gives a union field a selection set instead of leaving it bare', () => {
    const result = addPathToQuery('', 'query.categoryPage.content', null, schema);

    expect(result).toContain('__typename');
    expect(() => parse(result)).not.toThrow();
    expect(result).not.toMatch(/content\s*\n/);
  });

  it('gives an interface field the same treatment', () => {
    expect(addPathToQuery('', 'query.categoryPage.node', null, schema)).toContain('__typename');
  });

  it('leaves an object field alone', () => {
    expect(addPathToQuery('', 'query.categoryPage.meta', null, schema)).not.toContain('__typename');
  });

  it('puts __typename on the abstract parent, not inside each branch', () => {
    const result = addPathToQuery('', 'query.categoryPage.content.on:Image.url', null, schema);

    expect(result.match(/__typename/g)).toHaveLength(1);
    expect(result.indexOf('__typename')).toBeLessThan(result.indexOf('... on Image'));
  });

  it('does not duplicate __typename when the path is added again', () => {
    const once = addPathToQuery('', 'query.categoryPage.content', null, schema);
    const twice = addPathToQuery(once, 'query.categoryPage.content', null, schema);

    expect(twice.match(/__typename/g)).toHaveLength(1);
  });

  it('preserves a hand-written __typename', () => {
    const result = addPathToQuery(
      'query { categoryPage { content { __typename } } }',
      'query.categoryPage.content.on:Image.url',
      null,
      schema,
    );

    expect(result.match(/__typename/g)).toHaveLength(1);
  });

  // Unticking the last branch has to land back on a document that still runs.
  it('leaves a valid selection set after the last branch is removed', () => {
    const withBranch = addPathToQuery('', 'query.categoryPage.content.on:Image.url', null, schema);
    const result = deletePathFromQuery(withBranch, 'query.categoryPage.content.on:Image.url');

    expect(() => parse(result)).not.toThrow();
    expect(result).toContain('__typename');
    expect(result).not.toContain('... on Image');
  });

  it('adds nothing without a schema', () => {
    expect(addPathToQuery('', 'query.categoryPage.content')).not.toContain('__typename');
  });
});

describe('getFieldByPath', () => {
  const schema = buildSchema(/* GraphQL */ `
    type Query {
      posts: [Post!]!
      user: User
    }
    type Post {
      title: String!
      author: User
    }
    type User {
      name: String!
    }
  `);

  it('resolves a field through an object-typed parent', () => {
    expect(getFieldByPath('query.user.name', schema)?.name).toBe('name');
  });

  // The walk used to keep the wrapper type, so it silently stopped at the list
  // field and handed back the parent instead of the field the path named.
  it('resolves a field through a list-typed parent', () => {
    expect(getFieldByPath('query.posts.title', schema)?.name).toBe('title');
    expect(getFieldByPath('query.posts.author.name', schema)?.name).toBe('name');
  });

  it('returns null for a field the type does not have', () => {
    expect(getFieldByPath('query.posts.nope', schema)).toBeNull();
  });
});

describe('schemaToPaths', () => {
  const schema = buildSchema(/* GraphQL */ `
    type Query {
      user: User
      posts: [Post!]!
    }
    type User {
      id: ID!
      name: String!
      bestFriend: User
    }
    type Post {
      title: String!
    }
  `);

  it('walks object fields into dotted paths', () => {
    const paths = pathsToStrings(schemaToPaths(schema));
    expect(paths).toContain('query.user.name');
    expect(paths).toContain('query.posts.title');
  });

  it('stops at a recursive type to avoid infinite expansion', () => {
    const paths = pathsToStrings(schemaToPaths(schema));
    expect(paths).toContain('query.user.bestFriend');
    expect(paths).not.toContain('query.user.bestFriend.name');
  });
});

describe('searchSchemaPaths', () => {
  const schema = buildSchema(/* GraphQL */ `
    type Query {
      user: User
    }
    type User {
      id: ID!
      name: String!
    }
  `);

  it('matches a field by name and marks its ancestors visible and forced open', () => {
    const result = searchSchemaPaths(schema, 'name');
    expect(result.matchedPaths).toContain('query.user.name');
    expect(result.visiblePaths.has('query.user')).toBe(true);
    expect(result.forcedOpenPaths.has('query.user')).toBe(true);
  });

  it('returns an empty result for a blank search', () => {
    const result = searchSchemaPaths(schema, '   ');
    expect(result.matchedPaths).toEqual([]);
    expect(result.hasMore).toBe(false);
  });
});

describe('searchSchemaPaths across abstract types', () => {
  const schema = buildSchema(/* GraphQL */ `
    type Image {
      url: String
      caption: String
    }
    type Video {
      url: String
    }
    union CmsContent = Image | Video
    interface Node {
      id: ID!
    }
    type Article implements Node {
      id: ID!
      body: String
    }
    type Recursive {
      again: Wrapper
    }
    union Wrapper = Recursive
    type Page {
      content: [CmsContent!]!
      node: Node
      loop: Wrapper
    }
    type Query {
      page: Page
    }
  `);

  it('finds a field inside a union member', () => {
    const result = searchSchemaPaths(schema, 'caption');

    expect(result.matchedPaths).toContain('query.page.content.on:Image.caption');
  });

  it('forces the branch row open so the match is reachable', () => {
    const result = searchSchemaPaths(schema, 'caption');

    expect(result.forcedOpenPaths.has('query.page.content.on:Image')).toBe(true);
    expect(result.visiblePaths.has('query.page.content')).toBe(true);
  });

  it('finds the same field name in every member that declares it', () => {
    const result = searchSchemaPaths(schema, 'url');

    expect(result.matchedPaths).toContain('query.page.content.on:Image.url');
    expect(result.matchedPaths).toContain('query.page.content.on:Video.url');
  });

  it('finds a field an interface implementation adds', () => {
    const result = searchSchemaPaths(schema, 'body');

    expect(result.matchedPaths).toContain('query.page.node.on:Article.body');
  });

  it('leaves interface fields on the interface rather than in every branch', () => {
    const result = searchSchemaPaths(schema, 'id');

    expect(result.matchedPaths).toContain('query.page.node.id');
    expect(result.matchedPaths).not.toContain('query.page.node.on:Article.id');
  });

  // Matching runs on field names only. Without that, the `on:Image` segment would
  // make every field of Image a hit for a search that merely spells the type.
  it('does not match a field because its branch segment spells the search', () => {
    const result = searchSchemaPaths(schema, 'image');

    expect(result.matchedPaths).toEqual([]);
  });

  it('matches a dotted search through a branch', () => {
    const result = searchSchemaPaths(schema, 'content.caption');

    expect(result.matchedPaths).toContain('query.page.content.on:Image.caption');
  });

  it('terminates on a recursive union', () => {
    const result = searchSchemaPaths(schema, 'again');

    expect(result.hasMore).toBe(false);
    expect(result.matchedPaths.length).toBeGreaterThan(0);
  });
});

describe('schema path search index', () => {
  const index = createSchemaPathSearchIndex(['query.user.name', 'query.user.id']);

  it('matches a single term against the path without the operation prefix', () => {
    expect(searchSchemaPathIndex(index, 'name')).toEqual(['query.user.name']);
  });

  it('matches a dotted multi-segment search', () => {
    expect(searchSchemaPathIndex(index, 'user.name')).toEqual(['query.user.name']);
  });

  it('buildVisiblePathSet includes the full path plus every ancestor', () => {
    const set = buildVisiblePathSet(['query.user.name']);
    expect(set.has('query')).toBe(true);
    expect(set.has('query.user')).toBe(true);
    expect(set.has('query.user.name')).toBe(true);
  });

  it('buildForcedOpenPathSet includes only ancestors, not the leaf', () => {
    const set = buildForcedOpenPathSet(['query.user.name']);
    expect(set.has('query.user')).toBe(true);
    expect(set.has('query.user.name')).toBe(false);
  });
});

describe('mergeOpenPaths', () => {
  const DOCUMENT = ['query', 'query.billingPlans'];

  // Toggling a checkbox rewrites the document, which used to replace the open paths
  // outright and collapse everything the user had expanded by hand.
  it('keeps paths the user expanded when the document changes', () => {
    const merged = mergeOpenPaths(
      [...DOCUMENT, 'query.organizations', 'query.organizations.nodes'],
      DOCUMENT,
      [...DOCUMENT, 'query.billingPlans.basePrice'],
    );

    expect(merged).toContain('query.organizations');
    expect(merged).toContain('query.organizations.nodes');
    expect(merged).toContain('query.billingPlans.basePrice');
  });

  it('collapses a path once it leaves the document', () => {
    const merged = mergeOpenPaths([...DOCUMENT, 'query.me'], [...DOCUMENT, 'query.me'], DOCUMENT);

    expect(merged).not.toContain('query.me');
    expect(merged).toEqual(DOCUMENT);
  });

  it('keeps a manually expanded path even when it is absent from both documents', () => {
    const merged = mergeOpenPaths([...DOCUMENT, 'query.me.id'], DOCUMENT, DOCUMENT);

    expect(merged).toContain('query.me.id');
  });

  it('returns the same array when nothing moved, so no re-render is triggered', () => {
    const current = [...DOCUMENT];

    expect(mergeOpenPaths(current, DOCUMENT, DOCUMENT)).toBe(current);
  });
});
