import { useEffect } from 'react';
import { ShieldAlert } from 'lucide-react';
import { createPreview, type NavPath } from 'react-foundry';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '../button/button';
import { Input } from '../input/input';
import { RadioGroup } from '../radio-group/radio-group';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from './form';

export const nav: NavPath = 'Primitives/FormControls/Form';

/**
 * The field parts over react-hook-form: a small-caps label, the control wired to it, and a message
 * line that is always there so the form never jumps. Helper text lives in a tooltip beside the
 * label, behind an icon, rather than under the control. A group item is a fieldset with the label
 * as its legend, for a radio group or a selector that is not one input.
 */

const DemoFormSchema = z.object({
  name: z.string().min(3, 'Alert name must be at least 3 characters.'),
  threshold: z.string().regex(/^\d+$/, 'Threshold must be a whole number.'),
  severity: z.enum(['INFO', 'WARNING', 'CRITICAL']),
});

type DemoFormValues = z.infer<typeof DemoFormSchema>;

function DemoForm({
  defaultValues,
  submitOnMount,
}: {
  defaultValues: DemoFormValues;
  submitOnMount?: boolean;
}) {
  const form = useForm({ resolver: zodResolver(DemoFormSchema), defaultValues });
  useEffect(() => {
    if (submitOnMount) void form.trigger();
  }, [submitOnMount]);

  return (
    <div className="w-80">
      <Form form={form} onSubmit={() => {}}>
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel label="Alert name" tooltip="Shown in the notification channel." />
              <FormControl>
                <Input placeholder="P99 latency spike" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="threshold"
          render={({ field }) => (
            <FormItem>
              <FormLabel
                label="Threshold (ms)"
                icon={ShieldAlert}
                tooltip="Fires once the metric crosses this for the whole range."
              />
              <FormControl>
                <Input placeholder="500" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="severity"
          render={({ field }) => (
            <FormItem group>
              <FormLabel label="Severity" />
              <RadioGroup
                value={field.value}
                onValueChange={field.onChange}
                items={[
                  { value: 'INFO', label: 'Info' },
                  { value: 'WARNING', label: 'Warning' },
                  { value: 'CRITICAL', label: 'Critical' },
                ]}
              />
              <FormMessage />
            </FormItem>
          )}
        />
        <Button variant="primary" type="submit">
          Save alert
        </Button>
      </Form>
    </div>
  );
}

/** Submit with an invalid value to see the message appear on its reserved line. */
export const Default = createPreview(() => (
  <DemoForm defaultValues={{ name: '', threshold: '', severity: 'WARNING' }} />
));

/** The same form after a failed submit: the fields turn critical and the messages fill their lines. */
export const WithErrors = createPreview(() => (
  <DemoForm defaultValues={{ name: 'P9', threshold: '5ms', severity: 'WARNING' }} submitOnMount />
));
