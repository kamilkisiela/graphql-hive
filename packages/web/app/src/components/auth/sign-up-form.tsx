import { type ReactNode } from 'react';
import { type UseFormReturn } from 'react-hook-form';
import z from 'zod';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/primitives/form/form';
import { Input } from '@/components/ui/primitives/input/input';
import * as styles from './sign-up-form.css';

export const PasswordStringModel = z
  .string({
    required_error: 'Password is required',
  })
  .min(10, { message: 'Password must be at least 10 characters long.' })
  .regex(/[A-Z]/, { message: 'Password must contain at least one uppercase letter.' })
  .regex(/[!@#$%^&*(),.?":{}|<>]/, {
    message: 'Password must contain at least one special character.',
  })
  .regex(/[0-9]/, { message: 'Password must contain at least one digit.' })
  .regex(/[a-z]/, { message: 'Password must contain at least one lowercase letter.' });

export const SignUpFormSchema = z.object({
  firstName: z.string({
    required_error: 'First name is required',
  }),
  lastName: z.string({
    required_error: 'Last name is required',
  }),
  email: z
    .string({
      required_error: 'Email is required',
    })
    .email('Invalid email address'),
  password: PasswordStringModel,
});

export type SignUpFormValues = z.infer<typeof SignUpFormSchema>;

/**
 * The fields of the sign-up page. The page owns the form state, the mutations and the submit
 * button, so this can be exercised on its own.
 */
export function SignUpForm(props: {
  form: UseFormReturn<SignUpFormValues>;
  onSubmit: (values: SignUpFormValues) => void;
  submit: ReactNode;
}) {
  const { form } = props;
  return (
    <Form form={form} onSubmit={props.onSubmit}>
      <div className={styles.signUpFormDiv}>
        <FormField
          control={form.control}
          name="firstName"
          render={() => (
            <FormItem>
              <FormLabel label="First name" />
              <FormControl>
                <Input placeholder="Max" onSurface="raised" {...form.register('firstName')} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="lastName"
          render={() => (
            <FormItem>
              <FormLabel label="Last name" />
              <FormControl>
                <Input placeholder="Robinson" onSurface="raised" {...form.register('lastName')} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>
      <FormField
        control={form.control}
        name="email"
        render={() => (
          <FormItem>
            <FormLabel label="Email" />
            <FormControl>
              <Input
                placeholder="m@example.com"
                type="email"
                onSurface="raised"
                {...form.register('email')}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
      <FormField
        control={form.control}
        name="password"
        render={() => (
          <FormItem>
            <FormLabel label="Password" />
            <FormControl>
              <Input type="password" onSurface="raised" {...form.register('password')} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
      {props.submit}
    </Form>
  );
}
