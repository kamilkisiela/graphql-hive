import { ReactElement } from 'react';
import { PermissionsSpace, usePermissionsManager } from '@/components/organization/Permissions';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { FragmentType, graphql, useFragment } from '@/gql';
import { OrganizationAccessScope, ProjectAccessScope, TargetAccessScope } from '@/gql/graphql';
import { scopes } from '@/lib/access/common';

const ChangePermissionsModal_OrganizationFragment = graphql(`
  fragment ChangePermissionsModal_OrganizationFragment on Organization {
    ...UsePermissionManager_OrganizationFragment
  }
`);

export const ChangePermissionsModal_MemberFragment = graphql(`
  fragment ChangePermissionsModal_MemberFragment on Member {
    id
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
    <ChangePermissionsModalContent
      isOpen={isOpen}
      toggleModalOpen={toggleModalOpen}
      manager={manager}
      initialScopes={initialScopes}
      onSubmit={() => manager.submit}
    />
  );
}

export const ChangePermissionsModalContent = (props: {
  isOpen: boolean;
  toggleModalOpen: () => void;
  manager: ReturnType<typeof usePermissionsManager>;
  onSubmit: () => void;
  initialScopes: {
    organization: OrganizationAccessScope[];
    project: ProjectAccessScope[];
    target: TargetAccessScope[];
  };
}): ReactElement => {
  return (
    <Dialog open={props.isOpen} onOpenChange={props.toggleModalOpen}>
      <DialogContent className="w-[600px]">
        <form className="flex w-full flex-col items-center gap-5" onSubmit={props.manager.submit}>
          <DialogHeader>
            <DialogTitle>Permissions (legacy)</DialogTitle>
          </DialogHeader>
          <Tabs defaultValue="Organization" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="Organization">Organization</TabsTrigger>
              <TabsTrigger value="Projects">Projects</TabsTrigger>
              <TabsTrigger value="Targets">Targets</TabsTrigger>
            </TabsList>
            <PermissionsSpace
              title="Organization"
              scopes={scopes.organization}
              initialScopes={props.initialScopes.organization}
              selectedScopes={props.manager.organizationScopes}
              onChange={props.manager.setOrganizationScopes}
              checkAccess={props.manager.canAccessOrganization}
            />
            <PermissionsSpace
              title="Projects"
              scopes={scopes.project}
              initialScopes={props.initialScopes.project}
              selectedScopes={props.manager.projectScopes}
              onChange={props.manager.setProjectScopes}
              checkAccess={props.manager.canAccessProject}
            />
            <PermissionsSpace
              title="Targets"
              scopes={scopes.target}
              initialScopes={props.initialScopes.target}
              selectedScopes={props.manager.targetScopes}
              onChange={props.manager.setTargetScopes}
              checkAccess={props.manager.canAccessTarget}
            />
          </Tabs>
          <DialogFooter className="flex w-full gap-2">
            <Button
              type="button"
              size="lg"
              className="w-full justify-center"
              onClick={props.toggleModalOpen}
            >
              Cancel
            </Button>
            <Button type="submit" size="lg" className="w-full justify-center" variant="primary">
              Save permissions
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
