import { OrgRateLimitFieldsFragment } from '@/graphql';
import { Alert, AlertDescription, AlertIcon, AlertTitle, Box } from '@chakra-ui/react';
import React from 'react';

export const RateLimitWarn: React.FC<{
  organization: OrgRateLimitFieldsFragment;
}> = ({ organization }) => {
  if (organization.rateLimit.limitedForOperations || organization.rateLimit.limitedForSchemaPushes) {
    const limitedFor = [
      organization.rateLimit.limitedForOperations ? 'operations' : undefined,
      organization.rateLimit.limitedForSchemaPushes ? 'schema pushses' : undefined,
    ].filter(Boolean);

    return (
      <Alert status="warning" width="50%" m="5">
        <AlertIcon />
        <Box flex="1">
          <AlertTitle>Your organization is being rate-limited for {limitedFor.join(' and ')}.</AlertTitle>
          <AlertDescription display="block">
            Since you reached your organization rate-limit and data ingestion limitation, your organization{' '}
            <strong>{organization.name}</strong> is currently unable to ingest data.
            <br />
          </AlertDescription>
        </Box>
      </Alert>
    );
  }

  return null;
};
