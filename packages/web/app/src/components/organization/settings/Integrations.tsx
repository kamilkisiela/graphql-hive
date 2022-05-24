import React from 'react';
import 'twin.macro';
import { useQuery, useMutation } from 'urql';
import { Card } from '@/components/common';
import { Button, Table, Tbody, Tr, Td } from '@chakra-ui/react';
import { FaSlack, FaGithub } from 'react-icons/fa';
import {
  OrganizationFieldsFragment,
  CheckIntegrationsDocument,
  DeleteSlackIntegrationDocument,
  DeleteGitHubIntegrationDocument,
} from '@/graphql';

export const IntegrationsSettings: React.FC<{
  organization: OrganizationFieldsFragment;
}> = ({ organization }) => {
  const [query] = useQuery({
    query: CheckIntegrationsDocument,
    variables: {
      selector: {
        organization: organization.cleanId,
      },
    },
  });

  const [deleteSlackMutation, deleteSlack] = useMutation(DeleteSlackIntegrationDocument);
  const [deleteGitHubMutation, deleteGitHub] = useMutation(DeleteGitHubIntegrationDocument);

  const hasGitHubIntegration = query.data?.hasGitHubIntegration === true;
  const hasSlackIntegration = query.data?.hasSlackIntegration === true;

  return (
    <Card.Root>
      <Card.Title>Integrations</Card.Title>
      <Card.Content>
        <p>Connect Hive to other services.</p>
        <div tw="pt-3 space-y-3">
          <Table size="sm">
            <Tbody>
              <Tr>
                <Td>
                  {hasSlackIntegration ? (
                    <Button
                      isLoading={deleteSlackMutation.fetching}
                      disabled={deleteSlackMutation.fetching}
                      onClick={() => {
                        deleteSlack({
                          input: {
                            organization: organization.cleanId,
                          },
                        });
                      }}
                      leftIcon={<FaSlack />}
                      colorScheme="red"
                      size="sm"
                    >
                      Disconnect Slack
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      colorScheme="teal"
                      as="a"
                      href={`/api/slack/connect/${organization.cleanId}`}
                      leftIcon={<FaSlack />}
                    >
                      Connect Slack
                    </Button>
                  )}
                </Td>
                <Td>Alerts and notifications</Td>
                <Td></Td>
              </Tr>
              <Tr>
                <Td>
                  {hasGitHubIntegration ? (
                    <>
                      <Button
                        isLoading={deleteGitHubMutation.fetching}
                        disabled={deleteGitHubMutation.fetching}
                        onClick={() => {
                          deleteGitHub({
                            input: {
                              organization: organization.cleanId,
                            },
                          });
                        }}
                        leftIcon={<FaGithub />}
                        colorScheme="red"
                        size="sm"
                      >
                        Disconnect GitHub
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        as="a"
                        href={`/api/github/connect/${organization.cleanId}`}
                        tw="ml-3"
                      >
                        Adjust permissions
                      </Button>
                    </>
                  ) : (
                    <Button
                      size="sm"
                      colorScheme="teal"
                      as="a"
                      href={`/api/github/connect/${organization.cleanId}`}
                      leftIcon={<FaGithub />}
                    >
                      Connect GitHub
                    </Button>
                  )}
                </Td>
                <Td>Allow Hive to communicate with GitHub</Td>
              </Tr>
            </Tbody>
          </Table>
        </div>
      </Card.Content>
    </Card.Root>
  );
};
