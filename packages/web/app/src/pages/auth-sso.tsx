import { useCallback, useEffect } from 'react';
import { CircleHelpIcon } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { useSessionContext } from 'supertokens-auth-react/recipe/session';
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
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useToast } from '@/components/ui/use-toast';
import { env } from '@/env/frontend';
import { isProviderEnabled } from '@/lib/supertokens/thirdparty';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { Link, Navigate, useRouter } from '@tanstack/react-router';

const SSOFormSchema = z.object({
  slug: z
    .string({
      required_error: 'Slug is required',
    })
    .toLowerCase(),
});

type SSOFormValues = z.infer<typeof SSOFormSchema>;

async function fetchOidcId(input: { slug: string }) {
  const response = await fetch(`${env.graphqlPublicOrigin}/auth-api/oidc-id-lookup`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      slug: input.slug,
    }),
  });

  if (response.status >= 500) {
    throw new Error('Server error');
  }

  const data = (await response.json()) as Promise<
    | {
        ok: true;
        id: string;
      }
    | {
        ok: false;
        title: string;
        description: string;
        status: number;
      }
  >;

  return data;
}

export function AuthSSOPage(props: { redirectToPath: string }) {
  const session = useSessionContext();
  const router = useRouter();
  const sso = useMutation({
    mutationFn: fetchOidcId,
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
      <AuthCard>
        <AuthCardHeader
          title="Login with SSO"
          description="Sign in to your account with an organization slug"
        />
        <AuthCardContent>
          <AuthCardStack>
            <Form {...form}>
              <form className="grid gap-4" onSubmit={form.handleSubmit(onSubmit)}>
                <FormField
                  control={form.control}
                  name="slug"
                  render={() => (
                    <FormItem>
                      <FormLabel className="flex flex-row items-center gap-x-2">
                        Organization slug{' '}
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger>
                              <CircleHelpIcon className="size-4" />
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>
                                The organization slug is the unique identifier used in your
                                organization's URLs.
                              </p>
                              <p>For instance, in app.graphql-hive.com/acme, "acme" is the slug.</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </FormLabel>
                      <FormControl>
                        <Input placeholder="acme" {...form.register('slug')} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button type="submit" className="w-full" disabled={sso.isPending}>
                  {sso.isSuccess && sso.data.ok
                    ? 'Redirecting...'
                    : sso.isPending
                      ? 'Signing in...'
                      : 'Sign in'}
                </Button>
              </form>
            </Form>
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
        </AuthCardContent>
      </AuthCard>
    </>
  );
}
