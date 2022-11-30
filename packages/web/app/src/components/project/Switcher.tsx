import React from 'react';
import { useColorModeValue } from '@chakra-ui/react';
import { useQuery } from 'urql';
import 'twin.macro';
import { VscChevronDown } from 'react-icons/vsc';
import { Button, Menu, MenuButton, MenuList, MenuItem } from '@chakra-ui/react';
import { ProjectsDocument } from '@/graphql';
import { useRouteSelector } from '@/lib/hooks';

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
  const refinedData = React.useMemo(() => {
    if (!data?.projects?.nodes) {
      return null;
    }

    const currentProject = data?.projects?.nodes.find(node => node.cleanId === projectId);

    if (!currentProject) {
      return null;
    }

    return { items: data.projects.nodes, currentProject };
  }, [data]);

  const dropdownBgColor = useColorModeValue('white', 'gray.900');
  const dropdownTextColor = useColorModeValue('gray.700', 'gray.300');

  if (refinedData === null) {
    return null;
  }

  return (
    <Menu autoSelect={false}>
      <MenuButton
        size="sm"
        as={Button}
        rightIcon={<VscChevronDown />}
        variant="ghost"
        tw="font-normal"
      >
        {refinedData.currentProject.name}
      </MenuButton>
      <MenuList bg={dropdownBgColor} color={dropdownTextColor}>
        {refinedData.items.map(item => {
          return (
            <MenuItem
              onClick={() => {
                router.visitProject({
                  organizationId: organizationId,
                  projectId: item.cleanId,
                });
              }}
              key={item.cleanId}
            >
              {item.name}
            </MenuItem>
          );
        })}
      </MenuList>
    </Menu>
  );
};
