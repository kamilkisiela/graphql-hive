// @vitest-environment jsdom
import { formatDateToString } from '@/lib/date-math';
import { UTCDate } from '@date-fns/utc';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { DateRangePicker, presetLast7Days } from './date-range-picker';
import * as buttonStyles from './primitives/button/button.css';

describe('DateRangePicker', () => {
  it('renders its own segmented trigger at the form-control height', () => {
    render(<DateRangePicker selectedRange={presetLast7Days.range} />);
    const trigger = screen.getByRole('button', { name: 'Last 7 days' });
    const { size } = buttonStyles.buttonVariants.classNames.variants;
    expect(trigger.className).toContain(size.default);
    expect(trigger.className).not.toContain(size.compact);
  });

  it('takes the compact height for a filter row', () => {
    render(<DateRangePicker selectedRange={presetLast7Days.range} size="compact" />);
    expect(screen.getByRole('button', { name: 'Last 7 days' }).className).toContain(
      buttonStyles.buttonVariants.classNames.variants.size.compact,
    );
  });

  it('labels a relative range the quick-range list does not list by name', () => {
    // The pages used to pass the controller's label here, which falls back to absolute dates.
    render(<DateRangePicker selectedRange={{ from: 'now-3d', to: 'now' }} />);
    expect(screen.getByRole('button', { name: 'Last 3 days' })).toBeTruthy();
  });

  it('applies a quick range from the panel and closes', async () => {
    const onUpdate = vi.fn();
    render(<DateRangePicker selectedRange={presetLast7Days.range} onUpdate={onUpdate} />);
    fireEvent.click(screen.getByRole('button', { name: 'Last 7 days' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Last 30 days' }));
    expect(onUpdate).toHaveBeenCalledWith({
      preset: expect.objectContaining({ name: 'last30d' }),
    });
    await waitFor(() => expect(screen.queryByPlaceholderText('Filter quick ranges')).toBeNull());
  });

  it('lists every preset, greying out those that start before the start date', async () => {
    const DAY = 24 * 60 * 60 * 1000;
    render(
      <DateRangePicker
        selectedRange={presetLast7Days.range}
        startDate={new Date(Date.now() - 8 * DAY)}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Last 7 days' }));

    const preset = (name: string) =>
      screen.getAllByRole('button', { name }).at(-1) as HTMLButtonElement;
    await screen.findByRole('button', { name: 'Last 15 minutes' });
    expect(preset('Last 15 minutes').disabled).toBe(false);
    expect(preset('Last 7 days').disabled).toBe(false);
    expect(preset('Last 14 days').disabled).toBe(true);
    expect(preset('Last 1 year').disabled).toBe(true);
  });

  it('shows a footer under the custom range', async () => {
    render(<DateRangePicker selectedRange={presetLast7Days.range} footer={<span>a note</span>} />);
    fireEvent.click(screen.getByRole('button', { name: 'Last 7 days' }));
    expect(await screen.findByText('a note')).toBeTruthy();
  });

  describe('the custom range against a start date', () => {
    const DAY = 24 * 60 * 60 * 1000;
    // The UTC start of a day eight days ago, as the controller computes it.
    const startDate = new Date(Math.floor((Date.now() - 8 * DAY) / DAY) * DAY);
    const apply = () =>
      screen.getByRole('button', { name: 'Apply date range' }) as HTMLButtonElement;

    async function openWith(props: Partial<React.ComponentProps<typeof DateRangePicker>> = {}) {
      render(
        <DateRangePicker selectedRange={presetLast7Days.range} startDate={startDate} {...props} />,
      );
      fireEvent.click(screen.getByRole('button', { name: 'Last 7 days' }));
      return screen.findByLabelText('From');
    }

    it('refuses a start before it and disables Apply', async () => {
      const from = await openWith();
      fireEvent.change(from, { target: { value: '2020-01-01 00:00' } });
      expect(screen.getByText(/Must start on or after/)).toBeTruthy();
      expect(apply().disabled).toBe(true);
    });

    it('accepts the boundary day itself', async () => {
      const from = await openWith();
      fireEvent.change(from, { target: { value: formatDateToString(new UTCDate(startDate)) } });
      expect(screen.queryByText(/Must start on or after/)).toBeNull();
      expect(apply().disabled).toBe(false);
    });
  });

  it('fills both inputs from a two-click range in the calendar', async () => {
    render(<DateRangePicker selectedRange={presetLast7Days.range} />);
    fireEvent.click(screen.getByRole('button', { name: 'Last 7 days' }));
    fireEvent.click((await screen.findAllByRole('button', { name: 'Pick a date' }))[0]);
    // The first grid is last month, so both days are in the past and selectable.
    const grid = (await screen.findAllByRole('grid'))[0];
    fireEvent.click(within(grid).getByText('10'));
    fireEvent.click(within(grid).getByText('15'));
    const from = screen.getByLabelText('From') as HTMLInputElement;
    const to = screen.getByLabelText('To') as HTMLInputElement;
    await waitFor(() => expect(from.value).toMatch(/-10 00:00$/));
    expect(to.value).toMatch(/-15 23:59$/);
  });
});
