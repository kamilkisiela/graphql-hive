import { act, fireEvent, screen } from '@testing-library/react';

/**
 * Picks `option` from the `Select` whose `aria-label` is `combobox`. Base UI commits an option only
 * while it is highlighted, so focus and click are separate acts. An option with a description is
 * named by its label and description run together, so a label alone matches as a prefix.
 */
export async function pickOption(combobox: string, option: string | RegExp) {
  await act(async () => {
    fireEvent.click(screen.getByRole('combobox', { name: combobox }));
  });
  const item = await screen.findByRole('option', { name: option });
  await act(async () => {
    item.focus();
  });
  await act(async () => {
    fireEvent.click(item);
  });
}
