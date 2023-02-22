import { ReactElement } from 'react';
import { PermissionsSpace, usePermissionsManager } from '@/components/organization/Permissions';
import { Accordion, Button, Heading, Modal } from '@/components/v2';
import { FragmentType, graphql, useFragment } from '@/gql';
import { scopes } from '@/lib/access/common';

const ChangePermissionsModal_OrganizationFragment = graphql(`
  fragment ChangePermissionsModal_OrganizationFragment on Organization {
    ...UsePermissionManager_OrganizationFragment
  }
`);

const ChangePermissionsModal_MemberFragment = graphql(`
  fragment ChangePermissionsModal_MemberFragment on Member {
    ...UsePermissionManager_MemberFragment
  }
`);

export function ChangePermissionsModal({
  isOpen,
  toggleModalOpen,
  ...props
}: {
  isOpen: boolean;
  toggleModalOpen: () => void;
  organization: FragmentType<typeof ChangePermissionsModal_OrganizationFragment>;
  member: FragmentType<typeof ChangePermissionsModal_MemberFragment>;
}): ReactElement {
  const organization = useFragment(ChangePermissionsModal_OrganizationFragment, props.organization);
  const member = useFragment(ChangePermissionsModal_MemberFragment, props.member);
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
        <Accordion defaultValue="Organization">
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
}
