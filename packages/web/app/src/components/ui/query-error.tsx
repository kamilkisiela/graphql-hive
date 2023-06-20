import { ReactElement } from 'react';
import cookies from 'js-cookie';
import { CombinedError } from 'urql';
import { Button, Callout, Tag } from '@/components/v2';
import { LAST_VISITED_ORG_KEY } from '@/constants';
import { openChatSupport } from '@/utils';

export function QueryError({
  error,
  showError,
}: {
  error?: Error | CombinedError;
  showError?: boolean;
}): ReactElement {
  const requestId =
    error &&
    'response' in error &&
    error.response.headers.get('x-request-id')?.split(',')[0].trim();

  cookies.remove(LAST_VISITED_ORG_KEY);

  return (
    <Callout type="warning" className="w-1/2 mx-auto">
      <b>Oops, something went wrong.</b>
      <br />
      {showError ? (
        <Tag color="yellow">{error?.message?.replace('[GraphQL] ', '')}</Tag>
      ) : (
        <>
          Don't worry, our technical support got this error reported automatically. If you wish to
          track it later or share more details with us,{' '}
          <Button variant="link" onClick={openChatSupport}>
            you can use the support chat
          </Button>
          .
          <br />
          {requestId && (
            <span>
              Request ID: <Tag color="yellow">{requestId}</Tag>
            </span>
          )}
        </>
      )}
    </Callout>
  );
}
