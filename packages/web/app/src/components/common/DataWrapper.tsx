import React from 'react';
import { CombinedError, UseQueryState } from 'urql';
import {
  Box,
  AlertDescription,
  Center,
  Alert,
  Code,
  AlertIcon,
  Link,
  AlertTitle,
} from '@chakra-ui/react';
import { Spinner } from './Spinner';

export const QueryError: React.FC<{
  error?: Error | CombinedError;
  showError?: boolean;
}> = ({ error, showError }) => {
  let requestId =
    error instanceof CombinedError
      ? error.response?.headers?.get('x-request-id')
      : null;

  if (requestId) {
    requestId = requestId.split(',')[0].trim();
  }

  const openChatSupport = () => {
    if (typeof window !== 'undefined' && (window as any).$crisp) {
      (window as any).$crisp.push(['do', 'chat:open']);
    }
  };

  return (
    <Center>
      <Alert status="error" width="50%" m="5">
        <AlertIcon />
        <Box flex="1">
          <AlertTitle>Oops, something went wrong.</AlertTitle>
          {showError ? (
            <AlertDescription display="block">
              <Code>{error?.message?.replace('[GraphQL] ', '')}</Code>
            </AlertDescription>
          ) : (
            <AlertDescription display="block">
              Don't worry, our technical support got this error reported
              automatically. If you wish to track it later or share more details
              with us,{' '}
              <strong>
                <Link onClick={openChatSupport}>
                  you can use the support chat.
                </Link>{' '}
              </strong>
              {requestId ? (
                <span>
                  (Request ID: <Code>{requestId}</Code>)
                </span>
              ) : null}
            </AlertDescription>
          )}
        </Box>
      </Alert>
    </Center>
  );
};

export class DataWrapper<TData, TVariables> extends React.Component<{
  query: UseQueryState<TData, TVariables>;
  showStale?: boolean;
  loading?: boolean;
  children(props: { data: TData }): React.ReactNode;
  spinnerComponent?: React.ReactNode;
}> {
  render() {
    const { query, children, loading } = this.props;

    if (query.fetching || loading) {
      return this.props.spinnerComponent || <Spinner />;
    }

    if (query.error) {
      return <QueryError error={query.error} />;
    }

    return <>{children({ data: query.data })}</>;
  }
}
