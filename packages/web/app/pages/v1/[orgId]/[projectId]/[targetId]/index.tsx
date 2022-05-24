import React, { useCallback } from 'react';
import tw from 'twin.macro';
import {
  useDisclosure,
  Modal,
  Button,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalBody,
  Code,
  ModalFooter,
  ModalCloseButton,
  Alert,
  AlertTitle,
  AlertDescription,
  Spinner,
  Link,
  InputGroup,
  Input,
  InputRightElement,
  IconButton,
  useColorModeValue,
  Tooltip,
  Editable,
  EditablePreview,
  EditableInput,
} from '@chakra-ui/react';
import { VscPlug, VscClose, VscSync } from 'react-icons/vsc';
import { useQuery, useMutation } from 'urql';
import { useDebouncedCallback } from 'use-debounce';
import {
  SchemasDocument,
  SchemasQuery,
  ProjectFieldsFragment,
  ProjectType,
  TargetFieldsFragment,
  OrganizationFieldsFragment,
  CreateCdnTokenDocument,
  SchemaSyncCdnDocument,
  UpdateSchemaServiceNameDocument,
} from '@/graphql';
import { Description, Page } from '@/components/common';
import { DataWrapper } from '@/components/common/DataWrapper';
import { GraphQLSDLBlock } from '@/components/common/GraphQLSDLBlock';
import { TargetView } from '@/components/target/View';
import { NoSchemasYet } from '@/components/target/NoSchemasYet';
import { CopyValue } from '@/components/common/CopyValue';
import { useTargetAccess, TargetAccessScope } from '@/lib/access/target';

const Block = tw.div`mb-8`;

const SchemaServiceName: React.FC<{
  version: string;
  schema: SchemasQuery['target']['latestSchemaVersion']['schemas']['nodes'][0];
  target: SchemasQuery['target'];
  project: ProjectFieldsFragment;
  organization: OrganizationFieldsFragment;
}> = ({ target, project, organization, schema, version }) => {
  const [mutation, mutate] = useMutation(UpdateSchemaServiceNameDocument);
  const hasAccess = useTargetAccess({
    scope: TargetAccessScope.RegistryWrite,
    member: organization.me,
    redirect: false,
  });

  const submit = useCallback(
    (newName: string) => {
      if (schema.service === newName) {
        return;
      }

      if (newName.trim().length === 0) {
        return;
      }

      mutate({
        input: {
          organization: organization.cleanId,
          project: project.cleanId,
          target: target.cleanId,
          version,
          name: schema.service!,
          newName,
        },
      });
    },
    [mutate]
  );

  if ((project.type !== ProjectType.Federation && project.type !== ProjectType.Stitching) || !hasAccess) {
    return <>{schema.service}</>;
  }

  return (
    <Editable defaultValue={schema.service} isDisabled={mutation.fetching} onSubmit={submit}>
      <EditablePreview />
      <EditableInput />
    </Editable>
  );
};

const Schemas: React.FC<{
  organization: OrganizationFieldsFragment;
  project: ProjectFieldsFragment;
  target: SchemasQuery['target'];
  filterService?: string;
}> = ({ organization, project, target, filterService }) => {
  const schemas = target.latestSchemaVersion?.schemas.nodes ?? [];

  if (!schemas.length) {
    return <NoSchemasYet />;
  }

  if (project.type === ProjectType.Single) {
    return <GraphQLSDLBlock tw="mb-6" sdl={schemas[0].source} url={schemas[0].url} />;
  }

  return (
    <>
      {schemas
        .filter(schema => {
          if (filterService && schema.service) {
            return schema.service.toLowerCase().includes(filterService.toLowerCase());
          }

          return true;
        })
        .map(schema => (
          <Block key={schema.id}>
            <GraphQLSDLBlock
              sdl={schema.source}
              url={schema.url}
              title={
                <SchemaServiceName
                  version={target.latestSchemaVersion?.id}
                  schema={schema}
                  target={target}
                  project={project}
                  organization={organization}
                />
              }
            />
          </Block>
        ))}
    </>
  );
};

const SchemaView: React.FC<{
  organization: OrganizationFieldsFragment;
  project: ProjectFieldsFragment;
  target: TargetFieldsFragment;
  filterService?: string;
}> = ({ organization, project, target, filterService }) => {
  const [query] = useQuery({
    query: SchemasDocument,
    variables: {
      selector: {
        organization: organization.cleanId,
        project: project.cleanId,
        target: target.cleanId,
      },
    },
    requestPolicy: 'cache-and-network',
  });

  return (
    <DataWrapper query={query}>
      {() => (
        <Schemas
          organization={organization}
          project={project}
          target={query.data.target}
          filterService={filterService}
        />
      )}
    </DataWrapper>
  );
};

const ConnectSchemaModal: React.FC<{
  target: TargetFieldsFragment;
  project: ProjectFieldsFragment;
  organization: OrganizationFieldsFragment;
  onClose(): void;
  onOpen(): void;
  isOpen: boolean;
}> = ({ target, project, organization, onClose, isOpen }) => {
  const [generating, setGenerating] = React.useState(true);
  const [mutation, mutate] = useMutation(CreateCdnTokenDocument);

  React.useEffect(() => {
    if (!isOpen) {
      setGenerating(true);
      return;
    }

    mutate({
      selector: {
        organization: organization.cleanId,
        project: project.cleanId,
        target: target.cleanId,
      },
    }).then(() => {
      setTimeout(() => {
        setGenerating(false);
      }, 2000);
    });
  }, [isOpen, setGenerating, mutate]);

  const description = `With high-availability and multi-zone CDN service based on
  Cloudflare, Hive allows you to access ${
    project.type === ProjectType.Federation
      ? 'the supergraph'
      : project.type === ProjectType.Stitching
      ? 'the list of services'
      : 'the schema'
  } of your API,
  through a secured external service, that's always up regardless of
  Hive.`;

  const generatingDescription = `Hive is now generating an authentication token and an URL you can use to fetch your ${
    project.type === ProjectType.Federation
      ? 'supergraph schema'
      : project.type === ProjectType.Stitching
      ? 'services'
      : 'schema'
  }.`;

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="3xl">
      <ModalOverlay />
      <ModalContent>
        <ModalHeader>Connect to Hive</ModalHeader>
        <ModalCloseButton />
        <ModalBody>
          <Description>{description}</Description>
          <div tw="pt-6">
            {generating && (
              <Alert
                status="info"
                variant="subtle"
                flexDirection="column"
                alignItems="center"
                justifyContent="center"
                textAlign="center"
                height="200px"
              >
                <Spinner colorScheme="purple" />
                <AlertTitle mt={4} mb={1} fontSize="lg">
                  Generating access...
                </AlertTitle>
                <AlertDescription maxWidth="sm">{generatingDescription}</AlertDescription>
              </Alert>
            )}
          </div>
          {!generating && mutation.data && (
            <>
              <Description tw="mb-6">You can use the following endpoint:</Description>
              <CopyValue value={mutation.data.createCdnToken.url} width={'100%'} />
              <Description tw="mt-6">To authenticate, use the following HTTP headers:</Description>
              <Code tw="mt-6">X-Hive-CDN-Key: {mutation.data.createCdnToken.token}</Code>
              {project.type === ProjectType.Federation && (
                <Description tw="mt-6">
                  Read the{' '}
                  <Link
                    color="teal.500"
                    size="sm"
                    target="_blank"
                    href={`${process.env.NEXT_PUBLIC_DOCS_LINK}/features/registry-usage#apollo-federation`}
                  >
                    "Using the Registry with a Apollo Gateway"
                  </Link>{' '}
                  chapter in our documentation.
                </Description>
              )}
              {project.type === ProjectType.Stitching && (
                <Description tw="mt-6">
                  Read the{' '}
                  <Link
                    color="teal.500"
                    size="sm"
                    target="_blank"
                    href={`${process.env.NEXT_PUBLIC_DOCS_LINK}/features/registry-usage#schema-stitching`}
                  >
                    "Using the Registry when Stitching"
                  </Link>{' '}
                  chapter in our documentation.
                </Description>
              )}
              {project.type === ProjectType.Single && (
                <Description tw="mt-6">
                  Read the{' '}
                  <Link
                    color="teal.500"
                    size="sm"
                    target="_blank"
                    href={`${process.env.NEXT_PUBLIC_DOCS_LINK}/features/registry-usage#other-tools`}
                  >
                    "Using the Registry with any tool"
                  </Link>{' '}
                  chapter in our documentation.
                </Description>
              )}
            </>
          )}
        </ModalBody>
        <ModalFooter tw="space-x-6">
          <Button variant="ghost" type="button" onClick={onClose}>
            Close
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
};

const ConnectSchemaButton: React.FC<{
  target: TargetFieldsFragment;
  project: ProjectFieldsFragment;
  organization: OrganizationFieldsFragment;
}> = ({ target, project, organization }) => {
  const { onClose, onOpen, isOpen } = useDisclosure();
  const color = useColorModeValue('#fff', '#000');

  return (
    <>
      <Button colorScheme="primary" type="button" size="sm" onClick={onOpen} leftIcon={<VscPlug color={color} />}>
        Connect
      </Button>
      <ConnectSchemaModal
        target={target}
        project={project}
        organization={organization}
        isOpen={isOpen}
        onClose={onClose}
        onOpen={onOpen}
      />
    </>
  );
};

const SyncSchemaButton: React.FC<{
  target: TargetFieldsFragment;
  project: ProjectFieldsFragment;
  organization: OrganizationFieldsFragment;
}> = ({ target, project, organization }) => {
  const color = useColorModeValue('#fff', '#000');
  const [status, setStatus] = React.useState<'idle' | 'error' | 'success'>('idle');
  const [mutation, mutate] = useMutation(SchemaSyncCdnDocument);
  const hasAccess = useTargetAccess({
    scope: TargetAccessScope.RegistryWrite,
    member: organization.me,
    redirect: false,
  });

  const sync = useCallback(() => {
    mutate({
      input: {
        organization: organization.cleanId,
        project: project.cleanId,
        target: target.cleanId,
      },
    }).then(result => {
      if (result.error) {
        setStatus('error');
      } else {
        setStatus(result.data?.schemaSyncCDN.__typename === 'SchemaSyncCDNError' ? 'error' : 'success');
      }
      setTimeout(() => {
        setStatus('idle');
      }, 5000);
    });
  }, [mutate, setStatus]);

  if (!hasAccess || !target.hasSchema) {
    return null;
  }

  return (
    <Tooltip label="Re-upload the latest valid version to Hive CDN" fontSize="xs" placement="bottom-start">
      <Button
        colorScheme={status === 'success' ? 'teal' : status === 'error' ? 'red' : 'primary'}
        type="button"
        size="sm"
        onClick={sync}
        disabled={status !== 'idle' || mutation.fetching}
        isLoading={mutation.fetching}
        loadingText="Syncing..."
        leftIcon={<VscSync color={color} />}
      >
        {status === 'idle' ? 'Update CDN' : status === 'error' ? 'Failed to synchronize' : 'CDN is up to date'}
      </Button>
    </Tooltip>
  );
};

function TargetSchemaInner({
  organization,
  project,
  target,
}: {
  organization: OrganizationFieldsFragment;
  project: ProjectFieldsFragment;
  target: TargetFieldsFragment;
}) {
  const [filterService, setFilterService] = React.useState<string | null>(null);
  const [term, setTerm] = React.useState<string | null>(null);
  const debouncedFilter = useDebouncedCallback((value: string) => {
    setFilterService(value);
  }, 500);
  const handleChange = React.useCallback(
    event => {
      debouncedFilter(event.target.value);
      setTerm(event.target.value);
    },
    [debouncedFilter, setTerm]
  );
  const reset = React.useCallback(() => {
    setFilterService('');
    setTerm('');
  }, [setFilterService]);

  const isDistributed = project.type === ProjectType.Federation || project.type === ProjectType.Stitching;

  return (
    <Page
      title="Schema"
      subtitle="The latest schema you published for this target."
      actions={
        <>
          {isDistributed && (
            <form
              onSubmit={event => {
                event.preventDefault();
              }}
            >
              <InputGroup size="sm" variant="filled">
                <Input type="text" placeholder="Find service" value={term} onChange={handleChange} />
                <InputRightElement>
                  <IconButton aria-label="Reset" size="xs" variant="ghost" onClick={reset} icon={<VscClose />} />
                </InputRightElement>
              </InputGroup>
            </form>
          )}
          <SyncSchemaButton target={target} project={project} organization={organization} />
          <ConnectSchemaButton target={target} project={project} organization={organization} />
        </>
      }
    >
      <SchemaView organization={organization} project={project} target={target} filterService={filterService} />
    </Page>
  );
}

export default function TargetSchema() {
  return (
    <TargetView title="Overview">
      {({ organization, project, target }) => (
        <TargetSchemaInner organization={organization} project={project} target={target} />
      )}
    </TargetView>
  );
}
