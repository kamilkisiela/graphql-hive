// @vitest-environment jsdom
import { createRef } from 'react';
import { useForm } from 'react-hook-form';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from '@/components/ui/primitives/form/form';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { Textarea } from './textarea';
import * as inputStyles from '../input/input.css';
import * as shared from '../shared-styles.css';

function ReactHookFormField(props: { onSubmit: (values: { description: string }) => void }) {
  const form = useForm<{ description: string }>({ defaultValues: { description: '' } });
  return (
    <Form form={form} onSubmit={props.onSubmit}>
      <FormField
        control={form.control}
        name="description"
        rules={{ required: 'Description is required' }}
        render={({ field }) => (
          <FormItem>
            <FormControl>
              <Textarea placeholder="Description" {...field} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
      <button type="submit">Save</button>
    </Form>
  );
}

describe('Textarea', () => {
  it('renders a native textarea with its attributes and forwards the ref', () => {
    const ref = createRef<HTMLTextAreaElement>();
    render(<Textarea ref={ref} placeholder="Description" rows={3} maxLength={5000} />);
    const textarea = screen.getByPlaceholderText('Description');
    expect(ref.current).toBe(textarea);
    expect(textarea.getAttribute('rows')).toBe('3');
    expect(textarea.getAttribute('maxlength')).toBe('5000');
    expect(textarea.className).toContain(inputStyles.fieldClass);
    expect(textarea.className).toContain('text-sm');
  });

  it('keeps its own classes under a FormControl and reports an error', async () => {
    const onSubmit = vi.fn();
    render(<ReactHookFormField onSubmit={onSubmit} />);
    const textarea = screen.getByPlaceholderText('Description');
    expect(textarea.className).toContain(inputStyles.fieldClass2);
    expect(textarea.getAttribute('aria-invalid')).toBeNull();

    fireEvent.click(screen.getByText('Save'));
    expect(await screen.findByText('Description is required')).toBeTruthy();
    expect(textarea.getAttribute('aria-invalid')).toBe('true');

    fireEvent.change(textarea, { target: { value: 'Alerts for the checkout service' } });
    fireEvent.click(screen.getByText('Save'));
    // react-hook-form passes the submit event as the second argument.
    await waitFor(() =>
      expect(onSubmit).toHaveBeenCalledWith(
        { description: 'Alerts for the checkout service' },
        expect.anything(),
      ),
    );
  });

  it('marks the field invalid through the invalid prop', () => {
    render(<Textarea placeholder="Description" invalid />);
    expect(screen.getByPlaceholderText('Description').getAttribute('aria-invalid')).toBe('true');
  });

  it('paints the raised surface for a field inside a sheet or dialog', () => {
    render(<Textarea placeholder="Description" onSurface="raised" />);
    const textarea = screen.getByPlaceholderText('Description');
    expect(textarea.className).toContain(shared.controlSurfaceRaised);
    expect(textarea.className).toContain('dark:focus:bg-neutral-6');
    expect(textarea.className.split(' ')).not.toContain('bg-surface-control');
  });

  it('grows with its content when autoSize is set', () => {
    render(<Textarea placeholder="Description" autoSize mono />);
    const textarea = screen.getByPlaceholderText('Description') as HTMLTextAreaElement;
    expect(textarea.style.getPropertyValue('field-sizing')).toBe('content');
    expect(textarea.className).toContain('resize-none');
    expect(textarea.className).not.toContain('min-h-20');
    expect(textarea.className).toContain('font-mono');
  });
});
