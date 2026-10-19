// @vitest-environment jsdom
import { render, screen, waitFor } from '@testing-library/react';
import { RouterAt } from '../../../../foundry.router';
import { Navigation, type NavigationItem } from './navigation';
import * as styles from './navigation.css';

const TARGET = { organizationSlug: 'a', projectSlug: 'b', targetSlug: 'c' };

const TARGET_ITEMS: NavigationItem[] = [
  {
    label: 'Schema',
    to: '/$organizationSlug/$projectSlug/$targetSlug',
    params: TARGET,
    exact: true,
  },
  {
    label: 'Checks',
    to: '/$organizationSlug/$projectSlug/$targetSlug/checks',
    params: TARGET,
  },
  {
    label: 'Settings',
    to: '/$organizationSlug/$projectSlug/$targetSlug/settings',
    params: TARGET,
    visible: false,
  },
];

const PROPOSAL_ITEMS: NavigationItem[] = [
  {
    label: 'Details',
    to: '/$organizationSlug/$projectSlug/$targetSlug/proposals/$proposalId',
    params: { ...TARGET, proposalId: 'p' },
    search: { page: undefined, version: 'v3' },
    explicitUndefined: true,
  },
  {
    label: 'Schema',
    to: '/$organizationSlug/$projectSlug/$targetSlug/proposals/$proposalId',
    params: { ...TARGET, proposalId: 'p' },
    search: { page: 'schema', version: 'v3' },
  },
];

function renderAt(path: string, node: React.ReactNode) {
  return render(<RouterAt path={path}>{node}</RouterAt>);
}

async function current() {
  await screen.findByRole('navigation');
  return screen
    .getAllByRole('link')
    .filter(link => link.getAttribute('aria-current') === 'page')
    .map(link => link.textContent);
}

describe('Navigation', () => {
  it('marks the link whose path prefixes the URL and drops hidden items', async () => {
    renderAt('/a/b/c/checks/abc123', <Navigation aria-label="Target" items={TARGET_ITEMS} />);
    expect(await current()).toEqual(['Checks']);
    expect(screen.getAllByRole('link').map(link => link.textContent)).toEqual(['Schema', 'Checks']);
    expect(screen.getByRole('link', { name: 'Checks' }).getAttribute('href')).toBe('/a/b/c/checks');
  });

  it('marks an exact item only on its own path, whatever the search holds', async () => {
    renderAt('/a/b/c?service=users', <Navigation aria-label="Target" items={TARGET_ITEMS} />);
    expect(await current()).toEqual(['Schema']);
  });

  it('marks nothing at the root of a nested page when the root item is exact', async () => {
    renderAt('/a/b/c/insights', <Navigation aria-label="Target" items={TARGET_ITEMS} />);
    expect(await current()).toEqual([]);
  });

  it('marks a search-driven item when its search is part of the URL', async () => {
    renderAt(
      '/a/b/c/proposals/p?page=schema&version=v3&ts=1',
      <Navigation aria-label="Proposal" items={PROPOSAL_ITEMS} />,
    );
    expect(await current()).toEqual(['Schema']);
  });

  it('marks an explicitUndefined item only while its key is absent from the URL', async () => {
    renderAt(
      '/a/b/c/proposals/p?version=v3',
      <Navigation aria-label="Proposal" items={PROPOSAL_ITEMS} />,
    );
    expect(await current()).toEqual(['Details']);
  });

  it('applies the underline state classes through the link', async () => {
    renderAt('/a/b/c/checks', <Navigation aria-label="Target" items={TARGET_ITEMS} />);
    await current();
    const checks = screen.getByRole('link', { name: 'Checks' });
    expect(checks.classList.contains(styles.activeClassesUnderline)).toBe(true);
    expect(checks.classList.contains(styles.inactiveClassesUnderline)).toBe(false);
    // The underline is the link's own border, so any radius would round its ends.
    expect([...checks.classList].some(name => /^rounded/.test(name))).toBe(false);
    const schema = screen.getByRole('link', { name: 'Schema' });
    expect(schema.classList.contains(styles.inactiveClassesUnderline)).toBe(true);
  });

  it('renders the list variant as a column with the sub-page classes', async () => {
    renderAt(
      '/a/b/c/checks',
      <Navigation aria-label="Sections" variant="list" items={TARGET_ITEMS} />,
    );
    await current();
    const nav = screen.getByRole('navigation', { name: 'Sections' });
    expect(nav.querySelector('ul')?.className).toContain(
      styles.listVariants.classNames.variants.variant.list,
    );
    expect(
      screen.getByRole('link', { name: 'Checks' }).classList.contains(styles.activeClassesList),
    ).toBe(true);
    expect(
      screen.getByRole('link', { name: 'Schema' }).classList.contains(styles.activeClassesList),
    ).toBe(false);
  });

  it('puts item attrs on the anchor', async () => {
    renderAt(
      '/a/b/c',
      <Navigation
        aria-label="Target"
        items={[{ ...TARGET_ITEMS[1], attrs: { 'data-cy': 'checks-link' } }]}
      />,
    );
    await current();
    expect(document.querySelector('a[data-cy="checks-link"]')?.textContent).toBe('Checks');
  });

  it('keeps an item with a tooltip a link', async () => {
    renderAt(
      '/a/b/c/checks',
      <Navigation aria-label="Target" items={[{ ...TARGET_ITEMS[1], tooltip: 'Schema checks' }]} />,
    );
    expect(await current()).toEqual(['Checks']);
  });

  it('draws placeholders instead of links while loading', async () => {
    renderAt(
      '/a/b/c',
      <Navigation items={TARGET_ITEMS} loading attrs={{ 'data-cy': 'target-nav' }} />,
    );
    await waitFor(() => expect(document.querySelector('[data-cy="target-nav"]')).toBeTruthy());
    expect(screen.queryByRole('link')).toBeNull();
    expect(screen.queryByRole('navigation')).toBeNull();
  });

  it('keeps the actions outside the nav, after the links', async () => {
    renderAt(
      '/a/b/c',
      <Navigation
        items={TARGET_ITEMS}
        actions={<button type="button">Connect to CDN</button>}
        attrs={{ 'data-cy': 'target-nav' }}
      />,
    );
    await screen.findByRole('navigation');
    const bar = document.querySelector('[data-cy="target-nav"]')!;
    expect(bar.lastElementChild?.textContent).toBe('Connect to CDN');
    expect(screen.getByRole('navigation').textContent).not.toContain('Connect to CDN');
  });
});
