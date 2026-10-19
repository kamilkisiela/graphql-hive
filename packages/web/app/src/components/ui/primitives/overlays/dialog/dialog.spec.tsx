// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react';
import { Select } from '../../floating/select/select';
import { Dialog } from './dialog';
import * as partStyles from '../overlay-parts.css';
import * as styles from './dialog.css';

describe('Dialog', () => {
  it('renders the title, description, body and footer when open, capped at the requested width', () => {
    render(
      <Dialog
        open
        width="lg"
        title="Create collection"
        description="Keeps operations together."
        footer={<button type="button">Create</button>}
        attrs={{ 'data-cy': 'create-collection' }}
      >
        <p>Body</p>
      </Dialog>,
    );
    const dialog = screen.getByRole('dialog');
    expect(dialog.getAttribute('data-cy')).toBe('create-collection');
    expect(dialog.className).toContain(styles.widthClassLg);
    expect(screen.getByRole('heading', { name: 'Create collection' })).toBeTruthy();
    expect(screen.getByText('Keeps operations together.')).toBeTruthy();
    expect(screen.getByText('Body')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Create' })).toBeTruthy();
  });

  it('closes from the corner button and hides it when told to', () => {
    const onOpenChange = vi.fn();
    const { rerender } = render(<Dialog open onOpenChange={onOpenChange} title="Rename" />);
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(onOpenChange).toHaveBeenCalledWith(false, expect.anything());

    rerender(<Dialog open onOpenChange={onOpenChange} title="Rename" closeButton={false} />);
    expect(screen.queryByRole('button', { name: 'Close' })).toBeNull();
  });

  it('portals popups opened inside it into a mount out of its own flow', () => {
    render(
      <Dialog open title="Pick">
        <Select
          aria-label="Kind"
          options={[{ value: 'a', label: 'Alpha' }]}
          value="a"
          onValueChange={() => {}}
        />
      </Dialog>,
    );
    fireEvent.click(screen.getByRole('combobox', { name: 'Kind' }));
    const mount = screen.getByRole('listbox').closest('[data-overlay-portal-mount]');
    expect(mount).not.toBeNull();
    expect(mount!.parentElement).toBe(screen.getByRole('dialog'));
    expect(mount!.className).toContain(partStyles.overlayPortalMountDiv);
  });

  it('renders nothing until opened, and opens from its trigger', () => {
    render(
      <Dialog trigger={<button type="button">Open it</button>} title="Welcome">
        <p>Hello</p>
      </Dialog>,
    );
    expect(screen.queryByRole('dialog')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Open it' }));
    expect(screen.getByRole('dialog')).toBeTruthy();
  });
});
