// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { ErrorComponent } from './error';

vi.mock('@sentry/react', () => ({ captureException: () => {}, flush: async () => true }));
vi.mock('@/lib/auth/use-session', () => ({
  useSession: () => ({ loading: false, doesSessionExist: true, userId: 'user-1' }),
}));
vi.mock('@tanstack/react-router', () => ({ useRouter: () => ({ navigate: () => {} }) }));

describe('ErrorComponent', () => {
  it('positions the sign-out button inside the error block', () => {
    render(<ErrorComponent error={new Error('boom')} />);

    const button = screen.getByRole('button', { name: /Sign out/ });
    const absolute = button.closest('.absolute');
    expect(absolute).toBeTruthy();
    // The error renders inside a layout, so the nearest positioned ancestor has to be the error
    // block itself; without one the button lands on top of the header.
    const positioned = absolute!.parentElement?.closest('.relative, .absolute, .fixed');
    expect(positioned).toBeTruthy();
    expect(positioned!.contains(screen.getByText('Oops, something went wrong.'))).toBe(true);
  });
});
