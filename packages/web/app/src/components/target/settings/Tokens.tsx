import React from 'react';
import 'twin.macro';
import { useQuery, useMutation } from 'urql';
import { VscKey } from 'react-icons/vsc';
import { useFormik } from 'formik';
import * as Yup from 'yup';
import {
  Table,
  Tr,
  Td,
  Button,
  Checkbox,
  Input,
  FormHelperText,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalFooter,
  ModalBody,
  FormControl,
  FormLabel,
  Alert,
  AlertIcon,
  Accordion,
  AlertDescription,
  useDisclosure,
  useClipboard,
  Box,
} from '@chakra-ui/react';
import {
  TokensDocument,
  CreateTokenDocument,
  DeleteTokensDocument,
  TokenFieldsFragment,
  TargetFieldsFragment,
  OrganizationFieldsFragment,
} from '@/graphql';
import { Card, TimeAgo } from '@/components/common';
import { useRouteSelector } from '@/lib/hooks/use-route-selector';
import { scopes } from '@/lib/access/common';
import { TargetAccessScope, useTargetAccess } from '@/lib/access/target';
import {
  usePermissionsManager,
  PermissionsSpace,
} from '@/components/organization/Permissions';

const TokenRow: React.FC<{
  token: TokenFieldsFragment;
  checked: string[];
  onCheck(id: string): void;
  canManageTokens: boolean;
}> = ({ token, checked, onCheck, canManageTokens }) => {
  return (
    <Tr>
      <Td tw="w-10">
        {canManageTokens && (
          <Checkbox
            colorScheme="primary"
            defaultChecked={false}
            checked={checked.includes(token.id)}
            onChange={() => onCheck(token.id)}
          />
        )}
      </Td>
      <Td>{token.alias.replaceAll('*', '•')}</Td>
      <Td>{token.name}</Td>
      {token.lastUsedAt ? (
        <Td textAlign="right">
          last used <TimeAgo date={token.lastUsedAt} />
        </Td>
      ) : (
        <Td textAlign="right">not used yet</Td>
      )}
      <Td textAlign="right">
        created <TimeAgo date={token.date} />
      </Td>
    </Tr>
  );
};

const TokenCreator: React.FC<{
  organization: OrganizationFieldsFragment;
  target: TargetFieldsFragment;
  isOpen: boolean;
  onClose(): void;
}> = ({ organization, target, isOpen, onClose }) => {
  const router = useRouteSelector();
  const [mutation, mutate] = useMutation(CreateTokenDocument);

  const [state, setState] = React.useState<'FORM' | 'SECRET'>('FORM');
  const { hasCopied, onCopy } = useClipboard(
    mutation?.data?.createToken?.ok?.secret
  );
  const manager = usePermissionsManager({
    onSuccess() {},
    organization,
    member: organization.me,
  });

  const formik = useFormik({
    initialValues: {
      name: '',
    },
    validationSchema: Yup.object().shape({
      name: Yup.string().min(0).required('Must enter name'),
    }),
    async onSubmit(values) {
      if (formik.isValid && !mutation.fetching) {
        mutate({
          input: {
            organization: router.organizationId,
            project: router.projectId,
            target: target.cleanId,
            name: values.name,
            organizationScopes: manager.organizationScopes,
            projectScopes: manager.projectScopes,
            targetScopes: manager.targetScopes,
          },
        }).finally(() => {
          formik.resetForm();
          setState('SECRET');
        });
      }
    },
  });

  const isValid = React.useCallback(
    (name: keyof typeof formik.errors) => {
      return formik.touched[name] && !!formik.errors[name];
    },
    [formik]
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size="3xl"
      closeOnEsc={false}
      closeOnOverlayClick={false}
    >
      <ModalOverlay />
      <ModalContent as="form" onSubmit={formik.handleSubmit}>
        <ModalHeader>
          {state === 'SECRET'
            ? 'Token successfully created!'
            : 'Create an access token'}
        </ModalHeader>
        <ModalBody>
          {state === 'SECRET' && (
            <>
              <Alert
                status="success"
                variant="subtle"
                flexDirection="column"
                alignItems="center"
                justifyContent="center"
                textAlign="center"
                height="200px"
              >
                <AlertIcon boxSize="40px" mr={0} />
                <Box
                  mt={4}
                  mb={1}
                  display="flex"
                  alignItems="center"
                  width={'65%'}
                >
                  <Input
                    isReadOnly
                    fontWeight={600}
                    fontSize="lg"
                    border={0}
                    value={mutation?.data?.createToken?.ok?.secret}
                    placeholder={mutation?.data?.createToken?.ok?.secret}
                  ></Input>
                  <Button colorScheme="primary" onClick={onCopy}>
                    {hasCopied ? 'Copied' : 'Copy'}
                  </Button>
                </Box>
                <AlertDescription maxWidth="sm">
                  This is your unique API key and it is non-recoverable. If you
                  lose this key, you will need to create a new one.
                </AlertDescription>
              </Alert>
            </>
          )}
          {state === 'FORM' && (
            <>
              <div tw="pb-6">
                To access GraphQL Hive, your application or tool needs an active
                API key.
              </div>
              <FormControl isInvalid={isValid('name')}>
                <FormLabel>Name</FormLabel>
                <Input
                  name="name"
                  value={formik.values.name}
                  onChange={formik.handleChange}
                  onBlur={formik.handleBlur}
                  placeholder="My token"
                  type="text"
                />
                <FormHelperText>
                  This will be displayed on the tokens list, we recommend to
                  make it self-explanatory.
                </FormHelperText>
              </FormControl>
              <FormLabel tw="pt-6">Permissions</FormLabel>
              <Accordion defaultIndex={0}>
                <PermissionsSpace
                  title="Organization"
                  scopes={scopes.organization}
                  initialScopes={manager.organizationScopes}
                  onChange={manager.setOrganizationScopes}
                  checkAccess={manager.canAccessOrganization}
                />
                <PermissionsSpace
                  title="All Projects"
                  scopes={scopes.project}
                  initialScopes={manager.projectScopes}
                  onChange={manager.setProjectScopes}
                  checkAccess={manager.canAccessProject}
                />
                <PermissionsSpace
                  title="All targets"
                  scopes={scopes.target}
                  initialScopes={manager.targetScopes}
                  onChange={manager.setTargetScopes}
                  checkAccess={manager.canAccessTarget}
                />
              </Accordion>
            </>
          )}
        </ModalBody>
        <ModalFooter tw="space-x-6">
          {state === 'SECRET' && (
            <Button
              colorScheme="primary"
              type="button"
              onClick={() => {
                onClose();
                setState('FORM');
              }}
            >
              Ok, got it!
            </Button>
          )}
          {state === 'FORM' && (
            <>
              <Button
                variant="ghost"
                type="button"
                onClick={onClose}
                disabled={mutation.fetching}
              >
                Cancel
              </Button>
              <Button
                colorScheme="primary"
                type="submit"
                isLoading={mutation.fetching}
                disabled={!formik.isValid}
              >
                Generate token
              </Button>
            </>
          )}
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
};

const TokenCreatorTrigger: React.FC<{
  organization: OrganizationFieldsFragment;
  target: TargetFieldsFragment;
}> = ({ organization, target }) => {
  const { isOpen, onClose, onOpen: open } = useDisclosure();

  return (
    <>
      <Button
        leftIcon={<VscKey />}
        colorScheme="teal"
        variant="ghost"
        size="sm"
        onClick={open}
      >
        Generate new token
      </Button>
      <TokenCreator
        organization={organization}
        target={target}
        isOpen={isOpen}
        onClose={onClose}
      />
    </>
  );
};

export const TokensSettings: React.FC<{
  organization: OrganizationFieldsFragment;
  target: TargetFieldsFragment;
}> = ({ target, organization }) => {
  const router = useRouteSelector();
  const canManageTokens = useTargetAccess({
    member: organization.me,
    redirect: false,
    scope: TargetAccessScope.TokensWrite,
  });
  const [{ data }] = useQuery({
    query: TokensDocument,
    variables: {
      selector: {
        organization: router.organizationId,
        project: router.projectId,
        target: target.cleanId,
      },
    },
  });
  const [{ fetching: deleting }, mutate] = useMutation(DeleteTokensDocument);
  const [checked, setChecked] = React.useState<string[]>([]);
  const onCheck = React.useCallback(
    (id: string) => {
      if (checked.includes(id)) {
        setChecked(checked.filter((i) => i !== id));
      } else {
        setChecked(checked.concat(id));
      }
    },
    [checked, setChecked]
  );
  const deleteTokens = React.useCallback(() => {
    if (!deleting) {
      mutate({
        input: {
          organization: router.organizationId,
          project: router.projectId,
          target: target.cleanId,
          tokens: checked,
        },
      }).finally(() => {
        setChecked([]);
      });
    }
  }, [deleting, target, checked, setChecked, mutate, router]);

  return (
    <Card.Root>
      <Card.Title>Tokens</Card.Title>
      <Card.Description>
        Be careful! These tokens allow to read and write your target data.
      </Card.Description>
      <Card.Content>
        {canManageTokens && (
          <div tw="flex flex-row justify-between">
            <TokenCreatorTrigger organization={organization} target={target} />
            <div>
              <Button
                disabled={!canManageTokens || !checked.length || deleting}
                onClick={deleteTokens}
                colorScheme="red"
                size="sm"
              >
                Delete
              </Button>
            </div>
          </div>
        )}
        {data?.tokens.total ? (
          <Table striped tw="mt-3" size="sm">
            {data?.tokens &&
              data.tokens.nodes.map((token) => (
                <TokenRow
                  key={token.id}
                  token={token}
                  checked={checked}
                  onCheck={onCheck}
                  canManageTokens={canManageTokens}
                />
              ))}
          </Table>
        ) : null}
      </Card.Content>
    </Card.Root>
  );
};
