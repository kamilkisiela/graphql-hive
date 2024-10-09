import { useCallback, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { FaRegUserCircle } from 'react-icons/fa';
import { SiGithub, SiGoogle, SiOkta } from 'react-icons/si';
import { sendVerificationEmail } from 'supertokens-auth-react/recipe/emailverification';
import { useSessionContext } from 'supertokens-auth-react/recipe/session';
import { emailPasswordSignUp } from 'supertokens-auth-react/recipe/thirdpartyemailpassword';
import z from 'zod';
import {
  AuthCard,
  AuthCardContent,
  AuthCardHeader,
  AuthCardStack,
  AuthOrSeparator,
} from '@/components/auth';
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
import { TooltipProvider } from '@/components/ui/tooltip';
import { useToast } from '@/components/ui/use-toast';
import { env } from '@/env/frontend';
import { useLastAuthMethod } from '@/lib/supertokens/last-auth-method';
import { startAuthFlowForProvider } from '@/lib/supertokens/start-auth-flow-for-provider';
import { enabledProviders, isProviderEnabled } from '@/lib/supertokens/thirdparty';
import { exhaustiveGuard } from '@/lib/utils';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { Link, Navigate, useRouter } from '@tanstack/react-router';
import { SignInButton } from './auth-sign-in';

const SignUpFormSchema = z.object({
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
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

type SignUpFormValues = z.infer<typeof SignUpFormSchema>;

export function AuthSignUpPage(props: { redirectToPath: string }) {
  const [lastAuthMethod] = useLastAuthMethod();
  const router = useRouter();
  const session = useSessionContext();

  const sendVerificationEmailMutation = useMutation({
    mutationFn: () => sendVerificationEmail(),
    onSuccess() {
      void router.navigate({
        to: '/auth/verify-email',
      });
    },
    retry: 3,
    onError() {
      // In case of an error, we still want to redirect the user to the verify email page
      // so they can request a new verification email, if needed
      // and understand that the account was created.
      void router.navigate({
        to: '/auth/verify-email',
      });
    },
  });

  const signUp = useMutation({
    mutationFn: emailPasswordSignUp,
    onSuccess(data) {
      const status = data.status;

      switch (status) {
        case 'OK': {
          if (env.auth.requireEmailVerification) {
            sendVerificationEmailMutation.mutate();
          } else {
            void router.navigate({
              to: props.redirectToPath,
            });
          }
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
      await startAuthFlowForProvider(provider, props.redirectToPath);
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
      signUp.mutate({
        formFields: [
          {
            id: 'email',
            value: data.email,
          },
          {
            id: 'password',
            value: data.password,
          },
          {
            id: 'firstName',
            value: data.firstName,
          },
          {
            id: 'lastName',
            value: data.lastName,
          },
        ],
      });
    },
    [signUp.mutate],
  );

  if (session.loading) {
    // AuthPage component already shows a loading state
    return null;
  }

  if (session.doesSessionExist) {
    // Redirect to the home page if the user is already signed in
    return <Navigate to="/" />;
  }

  const isVerificationSettled = env.auth.requireEmailVerification
    ? sendVerificationEmailMutation.isSuccess || sendVerificationEmailMutation.isError
    : true;

  return (
    <>
      <Meta title="Sign Up" />
      <AuthCard>
        <AuthCardHeader
          title="Register"
          description="Enter your information to create an account"
        />
        <AuthCardContent>
          <AuthCardStack>
            <TooltipProvider delayDuration={200}>
              <Form {...form}>
                <form className="grid gap-4" onSubmit={form.handleSubmit(onSubmit)}>
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="firstName"
                      render={() => (
                        <FormItem>
                          <FormLabel>First name</FormLabel>
                          <FormControl>
                            <Input placeholder="Max" {...form.register('firstName')} />
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
                          <FormLabel>Last name</FormLabel>
                          <FormControl>
                            <Input placeholder="Robinson" {...form.register('lastName')} />
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
                        <FormLabel>Email</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="m@example.com"
                            type="email"
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
                        <FormLabel>Password</FormLabel>
                        <FormControl>
                          <Input type="password" {...form.register('password')} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <Button type="submit" className="w-full" disabled={isPending}>
                    {signUp.isSuccess && signUp.data.status === 'OK' && isVerificationSettled
                      ? 'Redirecting...'
                      : signUp.isPending
                        ? 'Creating account...'
                        : 'Create an account'}
                  </Button>
                </form>
              </Form>
              {enabledProviders.length ? <AuthOrSeparator /> : null}
              {isProviderEnabled('google') ? (
                <SignInButton previousSignIn={lastAuthMethod === 'google'} variant="outline">
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => thirdPartySignIn.mutate('google')}
                    disabled={isPending}
                  >
                    <SiGoogle className="mr-4 size-4" /> Sign up with Google
                  </Button>
                </SignInButton>
              ) : null}
              {isProviderEnabled('github') ? (
                <SignInButton previousSignIn={lastAuthMethod === 'github'} variant="outline">
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => thirdPartySignIn.mutate('github')}
                    disabled={isPending}
                  >
                    <SiGithub className="mr-4 size-4" /> Sign up with Github
                  </Button>
                </SignInButton>
              ) : null}
              {isProviderEnabled('okta') ? (
                <SignInButton previousSignIn={lastAuthMethod === 'okta'} variant="outline">
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => thirdPartySignIn.mutate('okta')}
                    disabled={isPending}
                  >
                    <SiOkta className="mr-4 size-4" /> Sign up with Okta
                  </Button>
                </SignInButton>
              ) : null}
              {isProviderEnabled('oidc') ? (
                <SignInButton previousSignIn={lastAuthMethod === 'oidc'} variant="outline">
                  <Button asChild variant="outline" className="w-full" disabled={isPending}>
                    <Link
                      to="/auth/sso"
                      search={{
                        redirectToPath: props.redirectToPath,
                      }}
                    >
                      <FaRegUserCircle className="mr-4 size-4" /> Sign up with SSO
                    </Link>
                  </Button>
                </SignInButton>
              ) : null}
            </TooltipProvider>
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
        </AuthCardContent>
      </AuthCard>
    </>
  );
}
