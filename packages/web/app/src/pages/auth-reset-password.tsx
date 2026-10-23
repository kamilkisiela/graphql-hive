import { useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { AuthCard, AuthCardStack } from '@/components/auth';
import {
  NewPasswordForm,
  NewPasswordFormSchema,
  ResetPasswordEmailForm,
  ResetPasswordFormSchema,
  type NewPasswordFormValues,
  type ResetPasswordFormValues,
} from '@/components/auth/reset-password-forms';
import { Meta } from '@/components/ui/meta';
import { Button } from '@/components/ui/primitives/button/button';
import { useToast } from '@/components/ui/primitives/toast/toast';
import { sendPasswordResetEmail, submitNewPassword } from '@/lib/auth/api';
import { useSession } from '@/lib/auth/use-session';
import { exhaustiveGuard } from '@/lib/utils';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { Link, Navigate } from '@tanstack/react-router';

function AuthResetPasswordEmail(props: { email: string | null; redirectToPath: string }) {
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
      resetEmail.mutate(data);
    },
    [resetEmail.mutate],
  );

  const session = useSession();

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
      <AuthCard
        title="Email sent"
        content={
          <AuthCardStack>
            <p>
              A password reset email has been sent to{' '}
              <span className="font-semibold">{form.getValues().email}</span>, if it exists in our
              system.
            </p>
            <p className="text-sm text-fg-secondary">
              If you don't receive an email, try to{' '}
              <button type="button" className="underline" onClick={resetEmail.reset}>
                reset your password again
              </button>
              .
            </p>
          </AuthCardStack>
        }
      />
    );
  }

  return (
    <AuthCard
      title="Reset your password"
      description="We will send you an email to reset your password"
      content={
        <>
          <ResetPasswordEmailForm
            form={form}
            onSubmit={onSubmit}
            submit={
              <Button type="submit" width="full" onSurface="raised" disabled={resetEmail.isPending}>
                {resetEmail.data?.status === 'OK'
                  ? 'Redirecting...'
                  : resetEmail.isPending
                    ? '...'
                    : 'Email me'}
              </Button>
            }
          />

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
        </>
      }
    />
  );
}

function AuthPasswordNew(props: { token: string; redirectToPath: string }) {
  const changePassword = useMutation({
    mutationFn: (data: NewPasswordFormValues) =>
      submitNewPassword({ token: props.token, password: data.newPassword }),
    onSuccess(data) {
      const status = data.status;

      switch (status) {
        case 'OK': {
          toast({
            title: 'Password changed',
            description: 'You can now sign in with your new password.',
          });
          break;
        }
        case 'FIELD_ERROR': {
          for (const field of data.formFields) {
            if (field.id === 'password') {
              form.setError('newPassword', {
                type: 'manual',
                message: field.error,
              });
            } else {
              toast({
                title: 'Field error',
                description: field.error,
                variant: 'destructive',
              });
            }
          }
          break;
        }
        case 'RESET_PASSWORD_INVALID_TOKEN_ERROR': {
          toast({
            title: 'Link expired',
            description: 'Please request a new password reset link.',
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
    resolver: zodResolver(NewPasswordFormSchema),
    defaultValues: {
      newPassword: '',
    },
    disabled: changePassword.isPending,
  });
  const { toast } = useToast();

  const onSubmit = useCallback(
    (data: NewPasswordFormValues) => {
      changePassword.reset();
      changePassword.mutate(data);
    },
    [changePassword.mutate],
  );

  const session = useSession();

  if (session.loading) {
    // AuthPage component already shows a loading state
    return null;
  }

  const isSent = changePassword.isSuccess && changePassword.data.status === 'OK';

  if (isSent) {
    return <Navigate to="/auth/sign-in" search={{ redirectToPath: props.redirectToPath }} />;
  }

  return (
    <AuthCard
      title="Change your password"
      description="Enter your new password"
      content={
        <>
          <NewPasswordForm
            form={form}
            onSubmit={onSubmit}
            submit={
              <Button
                type="submit"
                width="full"
                onSurface="raised"
                disabled={changePassword.isPending}
              >
                {changePassword.data?.status === 'OK'
                  ? 'Redirecting...'
                  : changePassword.isPending
                    ? '...'
                    : 'Change password'}
              </Button>
            }
          />

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
        </>
      }
    />
  );
}

export function AuthResetPasswordPage(props: {
  email: string | null;
  token: string | null;
  redirectToPath: string;
}) {
  return (
    <>
      <Meta title="Reset Password" />
      {props.token ? (
        <AuthPasswordNew redirectToPath={props.redirectToPath} token={props.token} />
      ) : (
        <AuthResetPasswordEmail email={props.email} redirectToPath={props.redirectToPath} />
      )}
    </>
  );
}
