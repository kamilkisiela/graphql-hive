import { useCallback, useEffect } from 'react';
import { CircleUserRound } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { AuthCard, AuthCardStack, AuthOrSeparator } from '@/components/auth';
import {
  SignUpForm,
  SignUpFormSchema,
  type SignUpFormValues,
} from '@/components/auth/sign-up-form';
import { GitHubIcon, GoogleIcon, OktaIcon } from '@/components/ui/brand-icon';
import { Meta } from '@/components/ui/meta';
import { Button } from '@/components/ui/primitives/button/button';
import { useToast } from '@/components/ui/primitives/toast/toast';
import { env } from '@/env/frontend';
import { signUp as signUpRequest } from '@/lib/auth/api';
import { useLastAuthMethod } from '@/lib/auth/last-auth-method';
import { enabledProviders, isProviderEnabled } from '@/lib/auth/providers';
import { startThirdPartyAuth } from '@/lib/auth/third-party';
import { useSession } from '@/lib/auth/use-session';
import { exhaustiveGuard } from '@/lib/utils';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { Link, Navigate, useRouter } from '@tanstack/react-router';
import { SignInButton } from './auth-sign-in';

export function AuthSignUpPage(props: { redirectToPath: string }) {
  const [lastAuthMethod] = useLastAuthMethod();
  const router = useRouter();
  const session = useSession();

  const signUp = useMutation({
    mutationFn: signUpRequest,
    onSuccess(data) {
      const status = data.status;

      switch (status) {
        case 'OK': {
          // The verify-email page sends the verification email itself when it mounts.
          void router.navigate({
            to: env.auth.requireEmailVerification ? '/auth/verify-email' : props.redirectToPath,
          });
          break;
        }
        case 'FIELD_ERROR': {
          for (const field of data.formFields) {
            form.setError(field.id as keyof SignUpFormValues, {
              type: 'manual',
              message: field.error,
            });
          }
          break;
        }
        case 'SIGN_UP_NOT_ALLOWED': {
          toast({
            title: 'Sign up not allowed',
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
      toast({
        title: 'An error occurred',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const thirdPartySignIn = useMutation({
    async mutationFn(provider: 'github' | 'google' | 'okta') {
      await startThirdPartyAuth(provider, props.redirectToPath);
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

  const isPending = signUp.isPending || thirdPartySignIn.isPending;

  const form = useForm({
    mode: 'onSubmit',
    resolver: zodResolver(SignUpFormSchema),
    defaultValues: {
      firstName: '',
      lastName: '',
      email: '',
      password: '',
    },
    disabled: isPending,
  });

  useEffect(() => {
    form.setFocus('firstName', { shouldSelect: true });
  }, [signUp.isPending]);

  const { toast } = useToast();

  const onSubmit = useCallback(
    (data: SignUpFormValues) => {
      signUp.reset();
      signUp.mutate(data);
    },
    [signUp.mutate],
  );

  if (session.loading) {
    // AuthPage component already shows a loading state
    return null;
  }

  if (session.doesSessionExist && signUp.isIdle && thirdPartySignIn.isIdle) {
    // Already signed in on arrival. Once a sign-up started here, onSuccess owns the navigation
    // (the store flips before the request resolves, and the page is still mounted afterwards).
    return <Navigate to="/" />;
  }

  return (
    <>
      <Meta title="Sign Up" />
      <AuthCard
        title="Register"
        description="Enter your information to create an account"
        content={
          <>
            <AuthCardStack>
              <>
                <SignUpForm
                  form={form}
                  onSubmit={onSubmit}
                  submit={
                    <Button type="submit" width="full" onSurface="raised" disabled={isPending}>
                      {signUp.isSuccess && signUp.data.status === 'OK'
                        ? 'Redirecting...'
                        : signUp.isPending
                          ? 'Creating account...'
                          : 'Create an account'}
                    </Button>
                  }
                />
                {enabledProviders.length ? <AuthOrSeparator /> : null}
                {isProviderEnabled('google') ? (
                  <SignInButton previousSignIn={lastAuthMethod === 'google'} variant="outline">
                    <Button
                      variant="outline"
                      width="full"
                      onClick={() => thirdPartySignIn.mutate('google')}
                      disabled={isPending}
                    >
                      <GoogleIcon className="mr-4 size-4" /> Sign up with Google
                    </Button>
                  </SignInButton>
                ) : null}
                {isProviderEnabled('github') ? (
                  <SignInButton previousSignIn={lastAuthMethod === 'github'} variant="outline">
                    <Button
                      variant="outline"
                      width="full"
                      onClick={() => thirdPartySignIn.mutate('github')}
                      disabled={isPending}
                    >
                      <GitHubIcon className="mr-4 size-4" /> Sign up with Github
                    </Button>
                  </SignInButton>
                ) : null}
                {isProviderEnabled('okta') ? (
                  <SignInButton previousSignIn={lastAuthMethod === 'okta'} variant="outline">
                    <Button
                      variant="outline"
                      width="full"
                      onClick={() => thirdPartySignIn.mutate('okta')}
                      disabled={isPending}
                    >
                      <OktaIcon className="mr-4 size-4" /> Sign up with Okta
                    </Button>
                  </SignInButton>
                ) : null}
                {isProviderEnabled('oidc') ? (
                  <SignInButton previousSignIn={lastAuthMethod === 'oidc'} variant="outline">
                    <Button
                      variant="outline"
                      width="full"
                      disabled={isPending}
                      render={
                        <Link to="/auth/sso" search={{ redirectToPath: props.redirectToPath }} />
                      }
                    >
                      <CircleUserRound className="mr-4 size-4" /> Sign up with SSO
                    </Button>
                  </SignInButton>
                ) : null}
              </>
            </AuthCardStack>
            <div className="mt-4 text-center text-sm">
              Already have an account?{' '}
              <Link
                to="/auth/sign-in"
                search={{ redirectToPath: props.redirectToPath }}
                data-auth-link="sign-in"
                className="underline"
              >
                Sign in
              </Link>
            </div>
          </>
        }
      />
    </>
  );
}
