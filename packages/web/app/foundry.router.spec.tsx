// @vitest-environment jsdom
import { renderToString } from 'react-dom/server';
import { Link, RouterProvider } from '@tanstack/react-router';
import { render as renderDom, screen } from '@testing-library/react';
import { previewRouter, PreviewSlotProvider, RouterAt } from './foundry.router';
import { useSlugs } from './src/lib/hooks/use-slugs';

/**
 * Guards the preview router. `Link` throws without router context, so if this breaks, every preview
 * rendering a real app component goes blank.
 */
function render(children: React.ReactNode) {
  return renderToString(
    <PreviewSlotProvider value={children}>
      <RouterProvider router={previewRouter} />
    </PreviewSlotProvider>,
  );
}

describe('preview router', () => {
  beforeAll(async () => {
    await previewRouter.load();
  });

  it('renders a Link with interpolated params', () => {
    const html = render(
      <Link
        to="/$organizationSlug/$projectSlug"
        params={{ organizationSlug: 'the-guild', projectSlug: 'graphql-hive' }}
      >
        my-project
      </Link>,
    );

    expect(html).toContain('/the-guild/graphql-hive');
    expect(html).toContain('my-project');
  });

  it('renders a disabled Link', () => {
    const html = render(
      <Link
        to="/$organizationSlug/$projectSlug"
        disabled
        params={{ organizationSlug: 'unknown-yet', projectSlug: 'unknown-yet' }}
      >
        placeholder
      </Link>,
    );

    expect(html).toContain('placeholder');
  });

  it('positions a RouterAt story at its path, so links know whether they are current', async () => {
    renderDom(
      <RouterAt path="/the-guild/graphql-hive">
        <Link to="/$organizationSlug" params={{ organizationSlug: 'the-guild' }}>
          org
        </Link>
        <Link
          to="/$organizationSlug/$projectSlug"
          params={{ organizationSlug: 'the-guild', projectSlug: 'graphql-hive' }}
        >
          project
        </Link>
      </RouterAt>,
    );

    const project = await screen.findByRole('link', { name: 'project' });
    expect(project.getAttribute('aria-current')).toBe('page');
    // A prefix of the URL counts as current too, which is what `exact` exists for on root items.
    expect(screen.getByRole('link', { name: 'org' }).getAttribute('aria-current')).toBe('page');
  });

  it("carries the app's layout route ids, so a page component can read its slugs", async () => {
    function Slugs() {
      const slugs = useSlugs('target');
      return <span>{[slugs.organizationSlug, slugs.projectSlug, slugs.targetSlug].join('/')}</span>;
    }

    renderDom(
      <RouterAt path="/the-guild/graphql-hive/production">
        <Slugs />
      </RouterAt>,
    );

    await screen.findByText('the-guild/graphql-hive/production');
  });
});
