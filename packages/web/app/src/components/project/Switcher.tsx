import React from 'react';
import { useColorModeValue } from '@chakra-ui/react';
import { useQuery } from 'urql';
import 'twin.macro';
import { VscChevronDown } from 'react-icons/vsc';
import { Button, Menu, MenuButton, MenuList, MenuItem } from '@chakra-ui/react';
import { ProjectsDocument } from '@/graphql';
import { useRouteSelector } from '@/lib/hooks/use-route-selector';

export const ProjectSwitcher: React.FC<{
  organizationId: string;
  projectId: string;
}> = ({ organizationId, projectId }) => {
  const router = useRouteSelector();
  const [{ data }] = useQuery({
    query: ProjectsDocument,
    variables: {
      selector: {
        organization: organizationId,
      },
    },
  });
  const items = React.useMemo(() => {
    if (!data?.projects?.nodes) {
      return [];
    }

    return data.projects.nodes.map(node => ({
      key: node.cleanId,
      label: node.name,
    }));
  }, [data]);

  const dropdownBgColor = useColorModeValue('white', 'gray.900');
  const dropdownTextColor = useColorModeValue('gray.700', 'gray.300');

  if (!items.length) {
    return null;
  }

  const currentProject = data.projects.nodes.find(node => node.cleanId === projectId);

  return (
    <Menu autoSelect={false}>
      <MenuButton size="sm" as={Button} rightIcon={<VscChevronDown />} variant="ghost" tw="font-normal">
        {currentProject.name}
      </MenuButton>
      <MenuList bg={dropdownBgColor} color={dropdownTextColor}>
        {items.map(item => {
          return (
            <MenuItem
              onClick={() => {
                router.visitProject({
                  organizationId: organizationId,
                  projectId: item.key,
                });
              }}
              key={item.key}
            >
              {item.label}
            </MenuItem>
          );
        })}
      </MenuList>
    </Menu>
  );
};
