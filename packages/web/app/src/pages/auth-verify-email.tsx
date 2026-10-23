import { useCallback, useEffect } from 'react';
import { useMutation } from 'urql';
import { AuthCard, AuthCardStack } from '@/components/auth';
import { Meta } from '@/components/ui/meta';
import { Button } from '@/components/ui/primitives/button/button';
import { useToast } from '@/components/ui/primitives/toast/toast';
import { graphql } from '@/gql';
import { useSession } from '@/lib/auth/use-session';
import { getRouteApi, Link, useNavigate } from '@tanstack/react-router';

const verifyEmailRoute = getRouteApi('/anonymous/auth/verify-email');

const SendVerificationEmailMutation = graphql(`
  mutation SendVerificationEmailMutation($input: SendVerificationEmailInput!) {
    sendVerificationEmail(input: $input) {
      ok {
        expiresAt
      }
      error {
        message
        emailAlreadyVerified
      }
    }
  }
`);

const VerifyEmailMutation = graphql(`
  mutation VerifyEmailMutation($input: VerifyEmailInput!) {
    verifyEmail(input: $input) {
      ok {
        verified
      }
      error {
        message
      }
    }
  }
`);

function AuthVerifyEmail() {
  const search = verifyEmailRoute.useSearch();
  const { toast } = useToast();
  const session = useSession();
  const userId = !session.loading && session.doesSessionExist ? session.userId : null;
  const navigate = useNavigate();

  const [sendEmailMutation, sendEmailImpl] = useMutation(SendVerificationEmailMutation);
  const [verifyMutation, verify] = useMutation(VerifyEmailMutation);

  const sendEmail = useCallback(
    async (resend?: boolean) => {
      if (userId === null) return;

      const result = await sendEmailImpl(
        {
          input: {
            userIdentityId: userId,
            resend,
          },
        },
        {
          fetchOptions: {
            headers: {
              'ignore-session': 'true',
            },
          },
        },
      );
      if (result.data?.sendVerificationEmail.ok) {
        toast({
          title: 'Verification email sent',
          description: 'Please check your email inbox.',
        });
      } else if (result.data?.sendVerificationEmail.error?.emailAlreadyVerified) {
        void navigate({ to: '/' });
      } else {
        toast({
          title: 'Failed to send verification email',
          description:
            result.data?.sendVerificationEmail.error?.message ??
            result.error?.message ??
            'An unknown error occurred.',
        });
      }
    },
    [userId, sendEmailImpl, toast],
  );

  useEffect(() => {
    if (session.loading) return;

    if (search.userIdentityId) {
      void verify(
        {
          input: {
            userIdentityId: search.userIdentityId,
            email: search.email,
            token: search.token,
          },
        },
        {
          fetchOptions: {
            headers: {
              'ignore-session': 'true',
            },
          },
        },
      );
    } else {
      void sendEmail();
    }
  }, [session.loading, search.userIdentityId, verify, sendEmail]);

  if (search.userIdentityId) {
    if (verifyMutation.error) {
      return (
        <AuthCard
          title="Failed to verify your email"
          content={
            <AuthCardStack>
              <p>There was an unexpected error when verifying your email address.</p>
              <Button
                width="full"
                onSurface="raised"
                disabled={sendEmailMutation.fetching}
                onClick={() => sendEmail(true)}
              >
                Resend verification email
              </Button>
              <Button variant="outline" width="full" render={<Link to="/logout" />}>
                Logout
              </Button>
            </AuthCardStack>
          }
        />
      );
    }

    if (verifyMutation.data?.verifyEmail.ok?.verified) {
      return (
        <AuthCard
          title="Success!"
          description="Your email address has been successfully verified."
          content={
            <AuthCardStack>
              <Button
                width="full"
                onSurface="raised"
                render={<Link to="/" data-button-verify-email-continue />}
              >
                Continue
              </Button>
            </AuthCardStack>
          }
        />
      );
    }

    if (verifyMutation.data?.verifyEmail.error) {
      return (
        <AuthCard
          title="Email verification"
          content={
            <AuthCardStack>
              <p>{verifyMutation.data?.verifyEmail.error.message}</p>
              <Button
                width="full"
                onSurface="raised"
                render={<Link to="/auth" search={{ redirectToPath: '/' }} />}
              >
                Continue
              </Button>
            </AuthCardStack>
          }
        />
      );
    }

    return (
      <AuthCard
        title="Verifying your email address"
        description="This should only take a few seconds."
        content={
          <AuthCardStack>
            <div className="flex justify-center">
              <div className="size-8 animate-spin rounded-full border-2 border-t-fg-muted" />
            </div>
          </AuthCardStack>
        }
      />
    );
  }

  return (
    <AuthCard
      title="Verify your email address"
      content={
        <AuthCardStack>
          <p>
            <span className="font-semibold">Please click on the link</span> in the email we just
            sent you to confirm your email address.
          </p>
          <Button
            type="button"
            width="full"
            onSurface="raised"
            disabled={sendEmailMutation.fetching}
            onClick={() => sendEmail(true)}
          >
            Resend verification email
          </Button>
          <Button variant="outline" width="full" render={<Link to="/logout" />}>
            Logout
          </Button>
        </AuthCardStack>
      }
    />
  );
}

export function AuthVerifyEmailPage() {
  return (
    <>
      <Meta title="Email verification" />
      <AuthVerifyEmail />
    </>
  );
}
