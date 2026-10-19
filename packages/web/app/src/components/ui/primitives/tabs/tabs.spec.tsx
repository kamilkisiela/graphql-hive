// @vitest-environment jsdom
import { act, fireEvent, render, screen } from '@testing-library/react';
import { Tabs } from './tabs';
import * as styles from './tabs.css';

const ITEMS = [
  {
    value: 'details',
    label: 'Details',
    content: <p>Details panel</p>,
    attrs: { 'data-testid': 'details-view-btn' },
  },
  { value: 'schema', label: 'Schema', content: <p>Schema panel</p> },
  { value: 'policy', label: 'Policy', disabled: true },
];

describe('Tabs', () => {
  it('wraps a horizontal strip in a sideways scroller and leaves a vertical one alone', () => {
    const { rerender } = render(<Tabs items={ITEMS} defaultValue="details" />);
    const list = screen.getByRole('tablist');
    const horizontalList = styles.listVariants.classNames.variants.orientation.horizontal;
    const horizontalScroller = styles.scrollerVariants.classNames.variants.orientation.horizontal;
    expect(list.className).toContain(horizontalList);
    expect(list.parentElement!.className).toContain(horizontalScroller);

    rerender(<Tabs items={ITEMS} defaultValue="details" orientation="vertical" />);
    expect(screen.getByRole('tablist').parentElement!.className).not.toContain(horizontalScroller);
  });

  it('renders a tab per item, shows the active panel, and switches on click', () => {
    const onValueChange = vi.fn();
    render(<Tabs items={ITEMS} defaultValue="details" onValueChange={onValueChange} />);
    expect(screen.getAllByRole('tab')).toHaveLength(3);
    expect(screen.getByRole('tab', { name: 'Details' }).getAttribute('data-testid')).toBe(
      'details-view-btn',
    );
    expect(screen.getByText('Details panel')).toBeTruthy();
    expect(screen.queryByText('Schema panel')).toBeNull();

    fireEvent.click(screen.getByRole('tab', { name: 'Schema' }));
    expect(onValueChange).toHaveBeenCalledWith('schema');
    expect(screen.getByText('Schema panel')).toBeTruthy();
    expect(screen.queryByText('Details panel')).toBeNull();
  });

  it('keeps a disabled tab out of reach and renders no panel for items without content', () => {
    render(<Tabs items={ITEMS} defaultValue="details" />);
    const policy = screen.getByRole('tab', { name: 'Policy' });
    expect(policy.getAttribute('aria-disabled')).toBe('true');
    expect(screen.getAllByRole('tabpanel')).toHaveLength(1);
  });

  it('hides the outgoing panel while Base UI waits for its exit transition', async () => {
    // jsdom has no Web Animations API, so Base UI drops the outgoing panel at once. A stubbed
    // animation that finishes on demand holds it in the ending state the way a browser does.
    let finish!: () => void;
    const finished = new Promise<void>(resolve => {
      finish = resolve;
    });
    HTMLElement.prototype.getAnimations = () => [
      { finished, pending: false, playState: 'running' } as unknown as Animation,
    ];
    try {
      render(<Tabs items={ITEMS} defaultValue="details" />);
      fireEvent.click(screen.getByRole('tab', { name: 'Schema' }));
      const outgoing = screen.getByText('Details panel').closest('[role="tabpanel"]')!;
      expect(outgoing.hasAttribute('data-ending-style')).toBe(true);
      expect(outgoing.hasAttribute('inert')).toBe(true);
      expect(outgoing.className).toContain(styles.panelVariants.classNames.base);
      expect(screen.getByText('Schema panel')).toBeTruthy();

      await act(async () => {
        finish();
        await new Promise(resolve => setTimeout(resolve, 0));
      });
      expect(screen.queryByText('Details panel')).toBeNull();
    } finally {
      delete (HTMLElement.prototype as { getAnimations?: unknown }).getAnimations;
    }
  });
});
