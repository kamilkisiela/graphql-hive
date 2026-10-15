// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react';
import { Accordion } from './accordion';

const ITEMS = [
  { value: 'a', label: 'Breaking', content: <p>Breaking panel</p>, attrs: { 'data-cy': 'row-a' } },
  { value: 'b', label: 'Safe', content: <p>Safe panel</p> },
  { value: 'c', label: 'Locked', content: <p>Locked panel</p>, disabled: true },
];

describe('Accordion', () => {
  it('opens one item at a time by default, and reports the open set', () => {
    const onValueChange = vi.fn();
    render(<Accordion items={ITEMS} onValueChange={onValueChange} />);
    expect(screen.queryByText('Breaking panel')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Breaking' }));
    expect(screen.getByText('Breaking panel')).toBeTruthy();
    expect(onValueChange).toHaveBeenLastCalledWith(['a']);

    fireEvent.click(screen.getByRole('button', { name: 'Safe' }));
    expect(screen.queryByText('Breaking panel')).toBeNull();
    expect(screen.getByText('Safe panel')).toBeTruthy();
    expect(onValueChange).toHaveBeenLastCalledWith(['b']);
  });

  it('keeps several open with multiple, and follows a controlled value', () => {
    const { rerender } = render(
      <Accordion items={ITEMS} multiple value={['a', 'b']} onValueChange={() => {}} />,
    );
    expect(screen.getByText('Breaking panel')).toBeTruthy();
    expect(screen.getByText('Safe panel')).toBeTruthy();

    rerender(<Accordion items={ITEMS} multiple value={[]} onValueChange={() => {}} />);
    expect(screen.queryByText('Breaking panel')).toBeNull();
  });

  it('puts trailing inside the trigger and action beside it, and lands attrs on item and trigger', () => {
    render(
      <Accordion
        items={[
          {
            ...ITEMS[0],
            trailing: <span>3 selected</span>,
            action: <button type="button">More</button>,
            triggerAttrs: { 'data-cy': 'row-a-trigger' },
          },
        ]}
      />,
    );
    const trigger = screen.getByRole('button', { name: /Breaking/ });
    expect(trigger.textContent).toContain('3 selected');
    expect(trigger.getAttribute('data-cy')).toBe('row-a-trigger');
    const more = screen.getByRole('button', { name: 'More' });
    expect(trigger.contains(more)).toBe(false);
    expect(document.querySelector('[data-cy="row-a"]')!.contains(more)).toBe(true);
  });

  it('will not open a disabled item', () => {
    render(<Accordion items={ITEMS} />);
    const locked = screen.getByRole('button', { name: 'Locked' });
    expect(locked.hasAttribute('disabled') || locked.getAttribute('aria-disabled') === 'true').toBe(
      true,
    );
    fireEvent.click(locked);
    expect(screen.queryByText('Locked panel')).toBeNull();
  });

  it('gives a boxed header a hover surface, clipped to the card, and none to the other variants', () => {
    const { container, rerender } = render(<Accordion items={ITEMS} variant="boxed" />);
    const header = () =>
      screen.getByRole('button', { name: 'Breaking' }).closest('h3')!.parentElement!;
    expect(header().className).toContain('hover]:bg-surface-hover');
    expect((container.firstElementChild!.firstElementChild as HTMLElement).className).toContain(
      'overflow-hidden',
    );

    rerender(<Accordion items={ITEMS} variant="list" />);
    expect(header().className).not.toContain('bg-surface-hover');
  });

  it('renders an item without content as a static row: no button, no chevron, same heading', () => {
    render(
      <Accordion
        items={[
          ITEMS[0],
          {
            value: 'static',
            label: 'Type removed',
            trailing: <span>Not tracked</span>,
            attrs: { 'data-cy': 'row-static' },
          },
        ]}
      />,
    );
    const row = document.querySelector('[data-cy="row-static"]')!;
    expect(row.querySelector('button')).toBeNull();
    expect(row.querySelector('svg')).toBeNull();
    expect(screen.getByRole('heading', { name: /Type removed/ }).textContent).toContain(
      'Not tracked',
    );

    // Its neighbour still opens.
    fireEvent.click(screen.getByRole('button', { name: 'Breaking' }));
    expect(screen.getByText('Breaking panel')).toBeTruthy();
  });

  it('treats null content as no content, even on a disabled item', () => {
    render(
      <Accordion
        items={[{ value: 'x', label: 'Nothing here', content: null, disabled: true }]}
        variant="boxed"
      />,
    );
    expect(screen.queryByRole('button')).toBeNull();
    const heading = screen.getByRole('heading', { name: 'Nothing here' });
    expect(heading.parentElement!.className).not.toContain('bg-surface-hover');
  });
});
