import React from 'react';
import 'twin.macro';
import {
  Button,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalFooter,
  ModalBody,
  ModalCloseButton,
  Accordion,
} from '@chakra-ui/react';
import {
  usePermissionsManager,
  PermissionsSpace,
} from '@/components/organization/Permissions';
import { MemberFieldsFragment, OrganizationFieldsFragment } from '@/graphql';
import { scopes } from '@/lib/access/common';
import { useTracker } from '@/lib/hooks/use-tracker';

export const MemberPermisssonsModal: React.FC<{
  isOpen: boolean;
  onClose(): void;
  organization: OrganizationFieldsFragment;
  member: MemberFieldsFragment;
}> = ({ isOpen, onClose, organization, member }) => {
  useTracker('MEMBERS_PERMISSIONS_MODAL', isOpen);
  const manager = usePermissionsManager({
    onSuccess: onClose,
    organization,
    member,
  });

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="3xl">
      <ModalOverlay />
      <ModalContent as="form" onSubmit={manager.submit}>
        <ModalHeader>Permissions</ModalHeader>
        <ModalCloseButton />
        <ModalBody>
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
        </ModalBody>
        <ModalFooter tw="space-x-6">
          <Button
            variant="ghost"
            type="button"
            disabled={manager.state !== 'IDLE'}
            onClick={onClose}
          >
            Cancel
          </Button>
          <Button
            colorScheme="primary"
            type="submit"
            disabled={manager.state !== 'IDLE'}
            isLoading={manager.state === 'LOADING'}
          >
            Save permissions
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
};
