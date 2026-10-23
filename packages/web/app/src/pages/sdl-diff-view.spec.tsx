// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { SDLDiffView } from './target-history-schema-version';

// The page module imports every page; these stand in for what cannot load under jsdom.
vi.mock('@/env/frontend', () => import('@/lib/testing/mocks/env'));
vi.mock('@graphql-hive/laboratory', () => import('@/lib/testing/mocks/laboratory'));
vi.mock(
  '@/lib/laboratory-history-storage',
  () => import('@/lib/testing/mocks/laboratory-history-storage'),
);
vi.mock('@/lib/auth/session', () => import('@/lib/testing/mocks/auth-session'));

// A diff past the time budget, without building one big enough to take that long.
vi.mock('@/components/ui/sdl-diff', () => ({
  useSdlDiff: () => ({ kind: 'too-large' }),
}));

describe('SDLDiffView, a diff too large to display', () => {
  it('says where to read the changes instead', () => {
    render(
      <SDLDiffView
        before="type Query { a: Int }"
        after="type Query { b: Int }"
        tooLargeMessage="Every change is listed in the Details tab."
      />,
    );

    expect(screen.getByText('Diff too large to display')).toBeTruthy();
    expect(screen.getByText('Every change is listed in the Details tab.')).toBeTruthy();
  });

  it('falls back to a plain explanation without a message', () => {
    render(<SDLDiffView before="type Query { a: Int }" after="type Query { b: Int }" />);

    expect(screen.getByText('The schemas differ in too many lines to compare here.')).toBeTruthy();
  });
});
