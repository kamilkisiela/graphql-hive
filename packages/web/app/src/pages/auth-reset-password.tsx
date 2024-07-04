import { useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { useSessionContext } from 'supertokens-auth-react/recipe/session';
import { sendPasswordResetEmail } from 'supertokens-auth-react/recipe/thirdpartyemailpassword';
import z from 'zod';
import { AuthCard, AuthCardContent, AuthCardHeader, AuthCardStack } from '@/components/auth';
import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Meta } from '@/components/ui/meta';
import { useToast } from '@/components/ui/use-toast';
import { exhaustiveGuard } from '@/lib/utils';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { Link, Navigate } from '@tanstack/react-router';

const ResetPasswordFormSchema = z.object({
  email: z
    .string({
      required_error: 'Email is required',
    })
    .email('Invalid email address'),
});

type ResetPasswordFormValues = z.infer<typeof ResetPasswordFormSchema>;

function AuthResetPassword(props: { email: string | null; redirectToPath: string }) {
  const initialEmail = props.email ?? '';

  const resetEmail = useMutation({
    mutationFn: sendPasswordResetEmail,
    onSuccess(data) {
      const status = data.status;

      switch (status) {
        case 'OK': {
          toast({
            title: 'Email sent',
            description: 'Please check your email to reset your password.',
          });
          break;
        }
        case 'FIELD_ERROR': {
          for (const field of data.formFields) {
            form.setError(field.id as keyof ResetPasswordFormValues, {
              type: 'manual',
              message: field.error,
            });
          }
          break;
        }
        case 'PASSWORD_RESET_NOT_ALLOWED': {
          toast({
            title: 'Password reset not allowed',
            description: 'Please contact support for assistance.',
            variant: 'destructive',
          });
          break;
        }
        default: {
          exhaustiveGuard(status);
        }
      }
    },
    onError(error) {
      console.error(error);
      toast({
        title: 'An error occurred',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
  const form = useForm({
    mode: 'onSubmit',
    resolver: zodResolver(ResetPasswordFormSchema),
    defaultValues: {
      email: initialEmail ?? '',
    },
    disabled: resetEmail.isPending,
  });
  const { toast } = useToast();

  const onSubmit = useCallback(
    (data: ResetPasswordFormValues) => {
      resetEmail.reset();
      resetEmail.mutate({
        formFields: [
          {
            id: 'email',
            value: data.email,
          },
        ],
      });
    },
    [resetEmail.mutate],
  );

  const session = useSessionContext();

  if (session.loading) {
    // AuthPage component already shows a loading state
    return null;
  }

  if (session.doesSessionExist) {
    // Redirect to the home page if the user is already signed in
    return <Navigate to="/" />;
  }

  const isSent = resetEmail.isSuccess && resetEmail.data.status === 'OK';

  if (isSent) {
    return (
      <AuthCard>
        <AuthCardHeader title="Email sent" />
        <AuthCardContent>
          <AuthCardStack>
            <p>
              A password reset email has been sent to{' '}
              <span className="font-semibold">{form.getValues().email}</span>, if it exists in our
              system.
            </p>
            <p className="text-muted-foreground text-sm">
              If you don't receive an email, try to{' '}
              <Link href="#" className="underline" onClick={resetEmail.reset}>
                reset your password again
              </Link>
              .
            </p>
          </AuthCardStack>
        </AuthCardContent>
      </AuthCard>
    );
  }

  return (
    <AuthCard>
      <AuthCardHeader
        title="Reset your password"
        description="We will send you an email to reset your password"
      />
      <AuthCardContent>
        <Form {...form}>
          <form className="grid gap-4" onSubmit={form.handleSubmit(onSubmit)}>
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email</FormLabel>
                  <FormControl>
                    <Input placeholder="m@example.com" type="email" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button type="submit" className="w-full" disabled={resetEmail.isPending}>
              {resetEmail.data?.status === 'OK'
                ? 'Redirecting...'
                : resetEmail.isPending
                  ? '...'
                  : 'Email me'}
            </Button>
          </form>
        </Form>

        <div className="mt-4 text-center text-sm">
          <Link
            to="/auth/sign-in"
            search={{
              redirectToPath: props.redirectToPath,
            }}
            data-auth-link="sign-up"
            className="underline"
          >
            Back to login
          </Link>
        </div>
      </AuthCardContent>
    </AuthCard>
  );
}

export function AuthResetPasswordPage(props: { email: string | null; redirectToPath: string }) {
  return (
    <>
      <Meta title="Reset Password" />
      <AuthResetPassword email={props.email} redirectToPath={props.redirectToPath} />
    </>
  );
}
