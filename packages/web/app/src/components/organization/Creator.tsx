import React, { ChangeEventHandler, FormEventHandler } from 'react';
import { useMutation } from 'urql';
import { Description, Label } from '@/components/common';
import { CreateOrganizationDocument } from '@/graphql';
import { useRouteSelector } from '@/lib/hooks';
import {
  Button,
  FormControl,
  FormLabel,
  Input,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
} from '@chakra-ui/react';

export const OrganizationCreator: React.FC<{
  isOpen: boolean;
  onClose(): void;
}> = ({ isOpen, onClose }) => {
  const router = useRouteSelector();
  const [{ fetching }, mutate] = useMutation(CreateOrganizationDocument);
  const [name, setName] = React.useState('');
  const submit = React.useCallback<FormEventHandler<HTMLElement>>(
    async evt => {
      evt.preventDefault();
      if (name) {
        const result = await mutate({
          input: {
            name,
          },
        });
        if (!result.data?.createOrganization.ok) {
          return;
        }

        onClose();
        router.visitOrganization({
          organizationId:
            result.data.createOrganization.ok.createdOrganizationPayload.organization.cleanId,
        });
      }
    },
    [mutate, router, name],
  );

  const onNameChange = React.useCallback<ChangeEventHandler<HTMLInputElement>>(
    evt => {
      setName(evt.target.value);
    },
    [setName],
  );

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="3xl">
      <ModalOverlay />
      <ModalContent as="form" onSubmit={submit}>
        <ModalHeader>Create an organization</ModalHeader>
        <ModalCloseButton />
        <ModalBody>
          <Description>
            An organization is built on top of <Label>Projects</Label>.
          </Description>
          <Description>
            You will become an <Label>admin</Label> and don't worry, you can add members later.
          </Description>
          <div className="pt-6 space-y-6">
            <FormControl>
              <FormLabel>Organization Name</FormLabel>
              <Input
                name="organization-name"
                value={name}
                disabled={fetching}
                onChange={onNameChange}
                placeholder="Name your organization"
                type="text"
              />
            </FormControl>
          </div>
        </ModalBody>
        <ModalFooter className="space-x-6">
          <Button variant="ghost" type="button" disabled={fetching} onClick={onClose}>
            Cancel
          </Button>
          <Button colorScheme="primary" type="submit" disabled={fetching}>
            Create Organization
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
};
