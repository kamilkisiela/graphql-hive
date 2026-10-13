// @vitest-environment jsdom
import { useEffect } from 'react';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { ToastProvider, useToast, type ToastOptions } from './toast';

function Fire(props: ToastOptions) {
  const { toast } = useToast();
  return (
    <button type="button" onClick={() => toast(props)}>
      Fire
    </button>
  );
}

// Base UI announces each toast through a separate live region and hides the visible toast from
// assistive tech, so the text appears twice and the toast has to be queried as hidden. Its role
// follows its priority.
describe('Toast', () => {
  it('renders the title and description on the variant, and closes from the corner button', () => {
    render(
      <ToastProvider>
        <Fire variant="destructive" title="Failed to save" description="Name is taken." />
      </ToastProvider>,
    );
    act(() => {
      fireEvent.click(screen.getByRole('button', { name: 'Fire' }));
    });
    const toast = screen.getByRole('alertdialog', { hidden: true });
    expect(toast.getAttribute('data-type')).toBe('destructive');
    expect(within(toast).getByText('Failed to save')).toBeTruthy();
    expect(within(toast).getByText('Name is taken.')).toBeTruthy();

    act(() => {
      fireEvent.click(toast.querySelector('button[aria-label="Close"]')!);
    });
    expect(screen.queryByRole('alertdialog', { hidden: true })).toBeNull();
  });

  it('keeps the toast function stable as toasts open, so an effect depending on it runs once', () => {
    const onEffect = vi.fn();
    function ToastOnMount() {
      const { toast } = useToast();
      useEffect(() => {
        onEffect();
        toast({ title: 'Verification email sent' });
      }, [toast]);
      return null;
    }
    render(
      <ToastProvider>
        <ToastOnMount />
      </ToastProvider>,
    );
    expect(onEffect).toHaveBeenCalledTimes(1);
    expect(screen.getAllByRole('dialog', { hidden: true })).toHaveLength(1);
  });

  it('hides after 5 seconds if not interacted with', () => {
    vi.useFakeTimers();
    render(
      <ToastProvider>
        <Fire title="Saved" />
      </ToastProvider>,
    );
    act(() => {
      fireEvent.click(screen.getByRole('button', { name: 'Fire' }));
    });
    expect(screen.getByRole('dialog', { hidden: true })).toBeTruthy();
    act(() => {
      vi.advanceTimersByTime(5001);
    });
    expect(screen.queryByRole('dialog', { hidden: true })).toBeNull();
    vi.useRealTimers();
  });
});
