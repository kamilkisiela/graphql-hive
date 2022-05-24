import { useTracker } from '@/lib/hooks/use-tracker';
import { Modal, ModalOverlay, ModalContent, ModalHeader, ModalBody, ModalCloseButton } from '@chakra-ui/react';
import { Description } from '@/components/common';

export const CustomizeLabModal: React.FC<{
  isOpen: boolean;
  onClose(): void;
}> = ({ isOpen, onClose }) => {
  useTracker('CONNECT_LAB', isOpen);

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="3xl">
      <ModalOverlay />
      <ModalContent>
        <ModalHeader>Customize</ModalHeader>
        <ModalCloseButton />
        <ModalBody>
          <Description>Test</Description>
        </ModalBody>
      </ModalContent>
    </Modal>
  );
};
