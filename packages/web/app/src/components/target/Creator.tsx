import * as React from 'react';
import 'twin.macro';
import { useMutation } from 'urql';
import { CreateTargetDocument } from '@/graphql';
import {
  Button,
  FormControl,
  FormLabel,
  Input,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalFooter,
  ModalBody,
  ModalCloseButton,
  useDisclosure,
} from '@chakra-ui/react';
import { Description, Label } from '@/components/common';
import { useRouteSelector } from '@/lib/hooks/use-route-selector';
import { useTracker } from '@/lib/hooks/use-tracker';

const TargetCreator: React.FC<{
  isOpen: boolean;
  onClose(): void;
}> = ({ isOpen, onClose }) => {
  useTracker('TARGET_CREATOR', isOpen);
  const router = useRouteSelector();
  const [name, setName] = React.useState('');
  const [{ fetching }, mutate] = useMutation(CreateTargetDocument);
  const submit = React.useCallback(
    (evt) => {
      evt.preventDefault();
      if (name) {
        mutate({
          input: {
            name,
            project: router.projectId,
            organization: router.organizationId,
          },
        }).then((result) => {
          if (!result.data?.createTarget.ok) {
            return;
          }
          onClose();
          router.visitTarget({
            organizationId: router.organizationId,
            projectId: router.projectId,
            targetId: result.data.createTarget.ok.createdTarget.cleanId,
          });
        });
      }
    },
    [router, mutate, name]
  );

  const onNameChange = React.useCallback(
    (evt) => {
      setName(evt.target.value);
    },
    [setName]
  );

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="3xl">
      <ModalOverlay />
      <ModalContent as="form" onSubmit={submit}>
        <ModalHeader>Create a target</ModalHeader>
        <ModalCloseButton />
        <ModalBody>
          <Description>
            A project is build on top of <Label>Targets</Label>, which are just
            your environments.
          </Description>
          <div tw="pt-6 space-y-6">
            <FormControl>
              <FormLabel>Target Name</FormLabel>
              <Input
                name="target-name"
                value={name}
                disabled={fetching}
                onChange={onNameChange}
                placeholder="Name your target"
                type="text"
              />
            </FormControl>
          </div>
        </ModalBody>
        <ModalFooter tw="space-x-6">
          <Button
            variant="ghost"
            type="button"
            disabled={fetching}
            onClick={onClose}
          >
            Cancel
          </Button>
          <Button colorScheme="primary" type="submit" disabled={fetching}>
            Create Target
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
};

export const TargetCreatorTrigger = () => {
  const { isOpen, onClose, onOpen: open } = useDisclosure();

  return (
    <>
      <Button colorScheme="primary" type="button" size="sm" onClick={open}>
        New Target
      </Button>
      <TargetCreator isOpen={isOpen} onClose={onClose} />
    </>
  );
};
