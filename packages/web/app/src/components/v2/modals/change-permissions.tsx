import { ReactElement } from 'react';
import { PermissionsSpace, usePermissionsManager } from '@/components/organization/Permissions';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button, Heading, Modal } from '@/components/v2';
import { FragmentType, graphql, useFragment } from '@/gql';
import { scopes } from '@/lib/access/common';

const ChangePermissionsModal_OrganizationFragment = graphql(`
  fragment ChangePermissionsModal_OrganizationFragment on Organization {
    ...UsePermissionManager_OrganizationFragment
  }
`);

export const ChangePermissionsModal_MemberFragment = graphql(`
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

  const initialScopes = {
    organization: [...manager.organizationScopes],
    project: [...manager.projectScopes],
    target: [...manager.targetScopes],
  };

  return (
    <Modal open={isOpen} onOpenChange={toggleModalOpen} className="w-[600px]">
      <form className="flex w-full flex-col items-center gap-5" onSubmit={manager.submit}>
        <Heading>Permissions (legacy)</Heading>
        <Tabs defaultValue="Organization" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="Organization">Organization</TabsTrigger>
            <TabsTrigger value="Projects">Projects</TabsTrigger>
            <TabsTrigger value="Targets">Targets</TabsTrigger>
          </TabsList>
          <PermissionsSpace
            title="Organization"
            scopes={scopes.organization}
            initialScopes={initialScopes.organization}
            selectedScopes={manager.organizationScopes}
            onChange={manager.setOrganizationScopes}
            checkAccess={manager.canAccessOrganization}
          />
          <PermissionsSpace
            title="Projects"
            scopes={scopes.project}
            initialScopes={initialScopes.project}
            selectedScopes={manager.projectScopes}
            onChange={manager.setProjectScopes}
            checkAccess={manager.canAccessProject}
          />
          <PermissionsSpace
            title="Targets"
            scopes={scopes.target}
            initialScopes={initialScopes.target}
            selectedScopes={manager.targetScopes}
            onChange={manager.setTargetScopes}
            checkAccess={manager.canAccessTarget}
          />
        </Tabs>
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
