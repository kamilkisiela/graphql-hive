import { ReactElement } from 'react';
import { Accordion } from '@chakra-ui/react';

import { PermissionsSpace, usePermissionsManager } from '@/components/organization/Permissions';
import { Button, Heading, Modal } from '@/components/v2';
import { MemberFieldsFragment, OrganizationFieldsFragment } from '@/graphql';
import { scopes } from '@/lib/access/common';

export const ChangePermissionsModal = ({
  isOpen,
  toggleModalOpen,
  organization,
  member,
}: {
  isOpen: boolean;
  toggleModalOpen: () => void;
  organization: OrganizationFieldsFragment;
  member: MemberFieldsFragment;
}): ReactElement => {
  const manager = usePermissionsManager({
    onSuccess: toggleModalOpen,
    organization,
    member,
    passMemberScopes: true,
  });

  return (
    <Modal open={isOpen} onOpenChange={toggleModalOpen} className="w-[600px]">
      <form className="flex flex-col items-center gap-5" onSubmit={manager.submit}>
        <Heading>Permissions</Heading>
        <Accordion defaultIndex={0} width="100%">
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
        <div className="flex w-full gap-2">
          <Button type="button" size="large" block onClick={toggleModalOpen}>
            Cancel
          </Button>
          <Button type="submit" size="large" block variant="primary">
            Save permissions
          </Button>
        </div>
      </form>
    </Modal>
  );
};
