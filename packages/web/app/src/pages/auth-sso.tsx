import { useCallback, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { AuthCard, AuthCardStack } from '@/components/auth';
import { SSOForm, SSOFormSchema, type SSOFormValues } from '@/components/auth/sso-form';
import { Meta } from '@/components/ui/meta';
import { Button } from '@/components/ui/primitives/button/button';
import { useToast } from '@/components/ui/primitives/toast/toast';
import { lookupOidcId } from '@/lib/auth/api';
import { isProviderEnabled } from '@/lib/auth/providers';
import { useSession } from '@/lib/auth/use-session';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { Link, Navigate, useRouter } from '@tanstack/react-router';

export function AuthSSOPage(props: { redirectToPath: string }) {
  const session = useSession();
  const router = useRouter();
  const sso = useMutation({
    mutationFn: lookupOidcId,
    onSuccess(data) {
      if (data.ok) {
        void router.navigate({
          to: '/auth/oidc',
          search: {
            id: data.id,
            redirectToPath: props.redirectToPath,
          },
        });
      } else {
        toast({
          title: data.title,
          description: data.description,
          variant: 'destructive',
        });
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
  const form = useForm({
    mode: 'onSubmit',
    resolver: zodResolver(SSOFormSchema),
    defaultValues: {
      slug: '',
    },
    disabled: sso.isPending,
  });

  useEffect(() => {
    form.setFocus('slug', { shouldSelect: true });
  }, [sso.isPending]);
  const { toast } = useToast();

  const onSubmit = useCallback(
    (data: SSOFormValues) => {
      sso.mutate({
        slug: data.slug,
      });
    },
    [sso.mutate],
  );

  if (session.loading) {
    // AuthPage component already shows a loading state
    return null;
  }

  if (session.doesSessionExist) {
    // Redirect to the home page if the user is already signed in
    return <Navigate to="/" />;
  }

  if (!isProviderEnabled('oidc')) {
    return <Navigate to="/auth/sign-in" search={{ redirectToPath: props.redirectToPath }} />;
  }

  return (
    <>
      <Meta title="Login with SSO" />
      <AuthCard
        title="Login with SSO"
        description="Sign in to your account with an organization slug"
        content={
          <>
            <AuthCardStack>
              <SSOForm
                form={form}
                onSubmit={onSubmit}
                submit={
                  <Button type="submit" width="full" onSurface="raised" disabled={sso.isPending}>
                    {sso.isSuccess && sso.data.ok
                      ? 'Redirecting...'
                      : sso.isPending
                        ? 'Signing in...'
                        : 'Sign in'}
                  </Button>
                }
              />
            </AuthCardStack>
            <div className="mt-4 text-center text-sm">
              <Link
                to="/auth/sign-in"
                search={{ redirectToPath: props.redirectToPath }}
                data-auth-link="sign-in"
                className="underline"
              >
                Back to other sign-in options
              </Link>
            </div>
          </>
        }
      />
    </>
  );
}
