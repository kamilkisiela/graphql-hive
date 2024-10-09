import { useCallback, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { FaRegUserCircle } from 'react-icons/fa';
import { SiGithub, SiGoogle, SiOkta } from 'react-icons/si';
import { useSessionContext } from 'supertokens-auth-react/recipe/session';
import { emailPasswordSignIn as superEmailPasswordSignIn } from 'supertokens-auth-react/recipe/thirdpartyemailpassword';
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
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useToast } from '@/components/ui/use-toast';
import { useLastAuthMethod } from '@/lib/supertokens/last-auth-method';
import { startAuthFlowForProvider } from '@/lib/supertokens/start-auth-flow-for-provider';
import { enabledProviders, isProviderEnabled } from '@/lib/supertokens/thirdparty';
import { cn, exhaustiveGuard } from '@/lib/utils';
import { zodResolver } from '@hookform/resolvers/zod';
import { Slot } from '@radix-ui/react-slot';
import { useMutation } from '@tanstack/react-query';
import { Link, Navigate, useRouter } from '@tanstack/react-router';

export function SignInButton(props: {
  children: React.ReactNode;
  previousSignIn: boolean;
  variant?: 'outline' | 'default';
  tooltipClassName?: string;
}) {
  if (props.previousSignIn) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <Slot
            className={cn(
              'animate-shimmer bg-[length:200%_100%] transition-colors',
              props.variant === 'outline'
                ? 'bg-[linear-gradient(110deg,transparent,48%,#202020,52%,transparent)]'
                : 'bg-[linear-gradient(110deg,transparent,30%,#a9a9a9,70%,transparent)]',
            )}
          >
            {props.children}
          </Slot>
        </TooltipTrigger>
        <TooltipContent className={cn('text-muted bg-white', props.tooltipClassName)} side="top">
          You signed in with it last time.
        </TooltipContent>
      </Tooltip>
    );
  }

  return <>{props.children}</>;
}

const SignInFormSchema = z.object({
  email: z
    .string({
      required_error: 'Email is required',
    })
    .email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

type SignInFormValues = z.infer<typeof SignInFormSchema>;

export function AuthSignInPage(props: { redirectToPath: string }) {
  const session = useSessionContext();
  const [lastAuthMethod, setLastAuthMethod] = useLastAuthMethod();
  const router = useRouter();
  const { toast } = useToast();

  const emailPasswordSignIn = useMutation({
    mutationFn: superEmailPasswordSignIn,
    onSuccess(data) {
      const status = data.status;

      switch (status) {
        case 'OK': {
          setLastAuthMethod('email');
          void router.navigate({
            to: props.redirectToPath,
          });
          break;
        }
        case 'WRONG_CREDENTIALS_ERROR': {
          toast({
            title: 'Invalid email or password',
            description: 'Please check your email and password and try again.',
            variant: 'destructive',
          });
          break;
        }
        case 'FIELD_ERROR': {
          for (const field of data.formFields) {
            form.setError(field.id as keyof SignInFormValues, {
              type: 'manual',
              message: field.error,
            });
          }
          break;
        }
        case 'SIGN_IN_NOT_ALLOWED': {
          toast({
            title: 'Sign in not allowed',
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

  const isPending = emailPasswordSignIn.isPending || thirdPartySignIn.isPending;

  const form = useForm({
    mode: 'onSubmit',
    resolver: zodResolver(SignInFormSchema),
    defaultValues: {
      email: '',
      password: '',
    },
    disabled: isPending,
  });

  useEffect(() => {
    if (emailPasswordSignIn.isPending === false) {
      form.setFocus('email', { shouldSelect: true });
    }
  }, [emailPasswordSignIn.isPending]);

  const onSubmit = useCallback(
    (data: SignInFormValues) => {
      emailPasswordSignIn.reset();
      emailPasswordSignIn.mutate({
        formFields: [
          {
            id: 'email',
            value: data.email,
          },
          {
            id: 'password',
            value: data.password,
          },
        ],
      });
    },
    [emailPasswordSignIn.mutate],
  );

  if (session.loading) {
    // AuthPage component already shows a loading state
    return null;
  }

  if (session.doesSessionExist) {
    // Redirect to the home page if the user is already signed in
    return <Navigate to="/" />;
  }

  return (
    <>
      <Meta title="Sign in" />
      <AuthCard>
        <AuthCardHeader title="Login" description="Sign in to your account" />
        <AuthCardContent>
          <AuthCardStack>
            <TooltipProvider delayDuration={200}>
              <Form {...form}>
                <form className="grid gap-4" onSubmit={form.handleSubmit(onSubmit)}>
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
                        <div className="flex items-center">
                          <FormLabel>Password</FormLabel>
                          <Link
                            tabIndex={-1}
                            to="/auth/reset-password"
                            search={{
                              email: form.getValues().email || undefined,
                              redirectToPath: props.redirectToPath,
                            }}
                            className="ml-auto inline-block text-sm underline"
                          >
                            Forgot your password?
                          </Link>
                        </div>
                        <FormControl>
                          <Input type="password" {...form.register('password')} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <SignInButton previousSignIn={lastAuthMethod === 'email'}>
                    <Button type="submit" className="w-full" disabled={isPending}>
                      {emailPasswordSignIn.data?.status === 'OK'
                        ? 'Redirecting...'
                        : emailPasswordSignIn.isPending
                          ? 'Signing in...'
                          : 'Sign in'}
                    </Button>
                  </SignInButton>
                </form>
              </Form>
              {enabledProviders.length ? <AuthOrSeparator /> : null}
              {isProviderEnabled('google') ? (
                <SignInButton variant="outline" previousSignIn={lastAuthMethod === 'google'}>
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => thirdPartySignIn.mutate('google')}
                    disabled={isPending}
                  >
                    <SiGoogle className="mr-4 size-4" /> Login with Google
                  </Button>
                </SignInButton>
              ) : null}
              {isProviderEnabled('github') ? (
                <SignInButton variant="outline" previousSignIn={lastAuthMethod === 'github'}>
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => thirdPartySignIn.mutate('github')}
                    disabled={isPending}
                  >
                    <SiGithub className="mr-4 size-4" /> Login with Github
                  </Button>
                </SignInButton>
              ) : null}

              {isProviderEnabled('okta') ? (
                <SignInButton variant="outline" previousSignIn={lastAuthMethod === 'okta'}>
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => thirdPartySignIn.mutate('okta')}
                    disabled={isPending}
                  >
                    <SiOkta className="mr-4 size-4" /> Login with Okta
                  </Button>
                </SignInButton>
              ) : null}
              {isProviderEnabled('oidc') ? (
                <SignInButton variant="outline" previousSignIn={lastAuthMethod === 'oidc'}>
                  <Button asChild variant="outline" className="w-full" disabled={isPending}>
                    <Link
                      to="/auth/sso"
                      search={{
                        redirectToPath: props.redirectToPath,
                      }}
                    >
                      <FaRegUserCircle className="mr-4 size-4" /> Login with SSO
                    </Link>
                  </Button>
                </SignInButton>
              ) : null}
            </TooltipProvider>
          </AuthCardStack>
          <div className="mt-4 text-center text-sm">
            Don't have an account?{' '}
            <Link
              to="/auth/sign-up"
              search={{
                redirectToPath: props.redirectToPath,
              }}
              data-auth-link="sign-up"
              className="underline"
            >
              Sign up
            </Link>
          </div>
        </AuthCardContent>
      </AuthCard>
    </>
  );
}
