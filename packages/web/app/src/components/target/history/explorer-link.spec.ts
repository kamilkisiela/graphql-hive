import { explorerLinkForChange } from './explorer-link';

describe('explorerLinkForChange', () => {
  it('links a type to its page', () => {
    expect(explorerLinkForChange({ path: ['Currency'], kind: 'TYPE_REMOVED' }, 'check')).toEqual({
      typename: 'Currency',
    });
  });

  it('links a field, argument or enum value to its type, filtered to the member', () => {
    expect(
      explorerLinkForChange({ path: ['User', 'legacyId'], kind: 'FIELD_REMOVED' }, 'check'),
    ).toEqual({ typename: 'User', search: 'legacyId' });
    expect(
      explorerLinkForChange(
        { path: ['Query', 'products', 'limit'], kind: 'FIELD_ARGUMENT_TYPE_CHANGED' },
        'check',
      ),
    ).toEqual({ typename: 'Query', search: 'products' });
    expect(
      explorerLinkForChange({ path: ['Status', 'ARCHIVED'], kind: 'ENUM_VALUE_REMOVED' }, 'check'),
    ).toEqual({ typename: 'Status', search: 'ARCHIVED' });
  });

  it("hides a check's additions, which the latest version doesn't have yet", () => {
    expect(explorerLinkForChange({ path: ['NewThing'], kind: 'TYPE_ADDED' }, 'check')).toBeNull();
    expect(
      explorerLinkForChange(
        { path: ['Query', 'products', 'region'], kind: 'FIELD_ARGUMENT_ADDED' },
        'check',
      ),
    ).toBeNull();
  });

  it("hides a version's removals and keeps its additions", () => {
    expect(
      explorerLinkForChange({ path: ['User', 'legacyId'], kind: 'FIELD_REMOVED' }, 'version'),
    ).toBeNull();
    expect(
      explorerLinkForChange({ path: ['User', 'email'], kind: 'FIELD_ADDED' }, 'version'),
    ).toEqual({ typename: 'User', search: 'email' });
  });

  it('keeps modified coordinates on both pages', () => {
    for (const page of ['check', 'version'] as const) {
      expect(explorerLinkForChange({ path: ['Status'], kind: 'TYPE_KIND_CHANGED' }, page)).toEqual({
        typename: 'Status',
      });
    }
  });

  it('has no link for a directive or a change without a coordinate', () => {
    expect(
      explorerLinkForChange({ path: ['@auth'], kind: 'DIRECTIVE_REMOVED' }, 'version'),
    ).toBeNull();
    expect(
      explorerLinkForChange({ path: null, kind: 'SCHEMA_QUERY_TYPE_CHANGED' }, 'check'),
    ).toBeNull();
  });

  it('links a directive usage to the type it sits on, unfiltered', () => {
    expect(
      explorerLinkForChange(
        { path: ['Query', '@cache'], kind: 'DIRECTIVE_USAGE_OBJECT_REMOVED' },
        'check',
      ),
    ).toEqual({ typename: 'Query' });
  });
});
