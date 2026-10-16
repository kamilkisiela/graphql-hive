/** Which page lists the change: a check compares against the latest version, a version against its predecessor. */
export type ExplorerLinkPage = 'check' | 'version';

/**
 * Where a change's coordinate is in Explorer, or null when Explorer can't show it. Explorer shows
 * the latest version, so a check's additions aren't there yet. A version's removals usually aren't
 * there any more, though on an older version a later change can make either guess wrong; the type
 * page's not-found state covers those.
 */
export function explorerLinkForChange(
  change: { path?: readonly string[] | null; kind: string },
  page: ExplorerLinkPage,
): { typename: string; search?: string } | null {
  const [typename, member] = change.path ?? [];
  if (!typename || typename.startsWith('@')) {
    return null;
  }
  if (change.kind.endsWith(page === 'check' ? '_ADDED' : '_REMOVED')) {
    return null;
  }
  return member && !member.startsWith('@') ? { typename, search: member } : { typename };
}
