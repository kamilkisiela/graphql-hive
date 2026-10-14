import { computeSdlDiff, getCachedSdlDiff } from './sdl-diff';

// The cache is module state, so every test uses schemas no other test does.
describe('computeSdlDiff', () => {
  it('diffs two schemas', () => {
    const result = computeSdlDiff('type A { id: ID }\n', 'type A { id: ID }\ntype B { id: ID }\n', {
      sorted: false,
    });

    expect(result.kind).toBe('diff');
    if (result.kind === 'diff') {
      expect(result.fileDiff.hunks).toHaveLength(1);
      expect(result.fileDiff.splitLineCount).toBeGreaterThan(0);
    }
  });

  it('reports identical schemas as unchanged', () => {
    expect(computeSdlDiff('type C { id: ID }', 'type C { id: ID }', { sorted: true })).toEqual({
      kind: 'unchanged',
    });
  });

  it('reports a reorder as order-only when sorted', () => {
    const before = 'type E { id: ID }\ntype D { id: ID }';
    const after = 'type D { id: ID }\ntype E { id: ID }';

    expect(computeSdlDiff(before, after, { sorted: true })).toEqual({ kind: 'order-only' });
  });

  it('diffs a reorder line by line when not sorted', () => {
    const before = 'type G { id: ID }\ntype F { id: ID }';
    const after = 'type F { id: ID }\ntype G { id: ID }';

    expect(computeSdlDiff(before, after, { sorted: false }).kind).toBe('diff');
  });

  it('gives up on a diff past the edit budget', () => {
    const before = 'type H { a: Int }\ntype I { b: Int }\n';
    const after = 'type H { c: Int }\ntype I { d: Int }\n';

    expect(
      computeSdlDiff(before, after, { sorted: false, diffOptions: { maxEditLength: 1 } }),
    ).toEqual({ kind: 'too-large' });
  });

  it('returns the cached result for the same input', () => {
    const before = 'type J { id: ID }\n';
    const after = 'type J { id: ID name: String }\n';

    const first = computeSdlDiff(before, after, { sorted: true });

    expect(getCachedSdlDiff(before, after, true)).toBe(first);
    expect(computeSdlDiff(before, after, { sorted: true })).toBe(first);
    expect(getCachedSdlDiff(before, after, false)).toBeUndefined();
  });

  it('keeps one result per diff tab of a check', () => {
    const tabs = ['K', 'L', 'M'].map(name => ({
      before: `type ${name} { id: ID }\n`,
      after: `type ${name} { id: ID name: String }\n`,
    }));
    const results = tabs.map(tab => computeSdlDiff(tab.before, tab.after, { sorted: false }));

    // Back to the first tab after visiting the other two still hits the cache.
    expect(getCachedSdlDiff(tabs[0].before, tabs[0].after, false)).toBe(results[0]);
  });
});
