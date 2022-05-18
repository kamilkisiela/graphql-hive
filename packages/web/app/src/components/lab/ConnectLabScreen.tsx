import { useTracker } from '@/lib/hooks/use-tracker';
import {
  Modal,
  Button,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalBody,
  Code,
  ModalFooter,
  ModalCloseButton,
} from '@chakra-ui/react';
import { Description } from '@/components/common';
import { CopyValue } from '../common/CopyValue';

export const ConnectLabModal: React.FC<{
  isOpen: boolean;
  onClose(): void;
  endpoint: string;
}> = ({ isOpen, onClose, endpoint }) => {
  useTracker('CONNECT_LAB', isOpen);

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="3xl">
      <ModalOverlay />
      <ModalContent>
        <ModalHeader>Connect</ModalHeader>
        <ModalCloseButton />
        <ModalBody>
          <Description>
            Hive allow you to consume and use this schema with your configured
            mocks while developing.
          </Description>
          <br />
          <Description>You can use the following endpoint:</Description>
          <br />
          <CopyValue value={endpoint} width={'100%'} />
          <br />
          <Description>
            To authenticate, use the following HTTP headers:
          </Description>
          <br />
          <Code>X-Hive-Key: YOUR_TARGET_TOKEN_HERE</Code>
          <br />
          <br />
          <Description>
            You can create target tokens from the Settings screen.
          </Description>
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
