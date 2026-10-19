// @vitest-environment jsdom
import { createRef } from 'react';
import { Search } from 'lucide-react';
import { useForm } from 'react-hook-form';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from '@/components/ui/primitives/form/form';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { Input } from './input';
import * as shared from '../shared-styles.css';
import * as styles from './input.css';

/** A field that FormControl wraps, the way every Form in the app does. */
function ReactHookFormField(props: { onSubmit: (values: { name: string }) => void }) {
  const form = useForm<{ name: string }>({ defaultValues: { name: '' } });
  return (
    <Form form={form} onSubmit={props.onSubmit}>
      <FormField
        control={form.control}
        name="name"
        rules={{ required: 'Name is required' }}
        render={({ field }) => (
          <FormItem>
            <FormControl>
              <Input placeholder="Name" {...field} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
      <button type="submit">Save</button>
    </Form>
  );
}

describe('Input', () => {
  it('renders a native input with its attributes and forwards the ref', () => {
    const ref = createRef<HTMLInputElement>();
    render(<Input ref={ref} type="email" placeholder="Email" autoComplete="off" data-cy="email" />);
    const input = screen.getByPlaceholderText('Email');
    expect(ref.current).toBe(input);
    expect(input).toHaveProperty('type', 'email');
    expect(input.getAttribute('autocomplete')).toBe('off');
    expect(input.getAttribute('data-cy')).toBe('email');
    // Regression: the merge used to drop the colour next to the theme's own font size.
    expect(input.className).toContain(styles.fieldClass);
    expect(input.className).toContain('text-sm');
    // Focus lifts the fill one step on every surface.
    expect(input.className).toContain('focus:bg-neutral-1');
    expect(input.className).toContain('dark:focus:bg-neutral-4');
    // Without this a type="search" field takes WebKit's native searchfield corners.
    expect(input.className).toContain(styles.fieldClass2);
  });

  it('marks the field invalid through aria-invalid, and only then', () => {
    const { rerender } = render(<Input placeholder="Name" />);
    expect(screen.getByPlaceholderText('Name').getAttribute('aria-invalid')).toBeNull();
    rerender(<Input placeholder="Name" invalid />);
    expect(screen.getByPlaceholderText('Name').getAttribute('aria-invalid')).toBe('true');
  });

  it('keeps its own classes under a FormControl', () => {
    // Regression: the old FormControl was a Radix Slot that merged a className into its child, an
    // empty one when the field was valid. Spread onto the input it wiped every class it had.
    render(<ReactHookFormField onSubmit={() => {}} />);
    const input = screen.getByPlaceholderText('Name');
    expect(input.className).toContain(styles.fieldClass2);
    expect(input.getAttribute('aria-invalid')).toBeNull();
  });

  it('reports a react-hook-form error and submits the typed value', async () => {
    const onSubmit = vi.fn();
    render(<ReactHookFormField onSubmit={onSubmit} />);
    fireEvent.click(screen.getByText('Save'));
    expect(await screen.findByText('Name is required')).toBeTruthy();
    const input = screen.getByPlaceholderText('Name');
    expect(input.getAttribute('aria-invalid')).toBe('true');

    fireEvent.change(input, { target: { value: 'production' } });
    fireEvent.click(screen.getByText('Save'));
    // react-hook-form passes the submit event as the second argument.
    await waitFor(() =>
      expect(onSubmit).toHaveBeenCalledWith({ name: 'production' }, expect.anything()),
    );
    expect(input.getAttribute('aria-invalid')).toBeNull();
  });

  it('paints the raised surface for a field inside a sheet or dialog', () => {
    render(<Input placeholder="Name" onSurface="raised" />);
    const input = screen.getByPlaceholderText('Name');
    expect(input.className).toContain(shared.controlSurfaceRaised);
    expect(input.className).toContain('dark:focus:bg-neutral-6');
    expect(input.className.split(' ')).not.toContain('bg-surface-control');
  });

  it('applies size, width and mono as classes', () => {
    render(<Input placeholder="Page" size="compact" width="xs" mono />);
    const input = screen.getByPlaceholderText('Page');
    expect(input.className).toContain(shared.controlSizeCompact);
    expect(input.className).toContain('w-16');
    expect(input.className).toContain('font-mono');
  });

  it('renders the prefix text, leading icon and trailing slot around the field', () => {
    render(
      <Input
        placeholder="slug"
        prefixText="app.graphql-hive.com/"
        leadingIcon={Search}
        trailing={<button type="button">Clear</button>}
        width="sm"
      />,
    );
    const input = screen.getByPlaceholderText('slug');
    expect(screen.getByText('app.graphql-hive.com/')).toBeTruthy();
    expect(screen.getByText('Clear')).toBeTruthy();
    expect(input.className).toContain(styles.inputInput3);
    expect(input.className).toContain(styles.inputInput);
    expect(input.className).toContain(styles.inputInput2);
    // A fixed width is the field's own; the prefix adds to it rather than eating into it.
    expect(input.className).toContain('w-48');
    expect(input.parentElement?.className).not.toContain(styles.inputSpan2);
  });

  it('lets a fluid decorated field fill its container', () => {
    render(<Input placeholder="Search" leadingIcon={Search} />);
    const input = screen.getByPlaceholderText('Search');
    expect(input.className).toContain('w-full');
    expect(input.parentElement?.className).toContain(styles.inputSpan2);
  });
});
