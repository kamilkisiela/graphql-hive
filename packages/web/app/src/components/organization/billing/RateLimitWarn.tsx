import React from 'react';
import { OrgRateLimitFieldsFragment } from '@/graphql';
import { Alert, AlertDescription, AlertIcon, AlertTitle, Box } from '@chakra-ui/react';

export const RateLimitWarn: React.FC<{
  organization: OrgRateLimitFieldsFragment;
}> = ({ organization }) => {
  if (organization.rateLimit.limitedForOperations) {
    return (
      <Alert status="warning" width="50%" m="5">
        <AlertIcon />
        <Box flex="1">
          <AlertTitle>Your organization is being rate-limited for operations.</AlertTitle>
          <AlertDescription display="block">
            Since you reached your organization rate-limit and data ingestion limitation, your
            organization <strong>{organization.name}</strong> is currently unable to ingest data.
            <br />
          </AlertDescription>
        </Box>
      </Alert>
    );
  }

  return null;
};
