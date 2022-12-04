import React from 'react';
import { useQuery } from 'urql';
import { useColorModeValue } from '@chakra-ui/react';
import 'twin.macro';
import { VscChevronDown } from 'react-icons/vsc';
import { Button, Menu, MenuButton, MenuList, MenuItem } from '@chakra-ui/react';
import { TargetsDocument } from '@/graphql';
import { useRouteSelector } from '@/lib/hooks';

export const TargetSwitcher: React.FC<{
  organizationId: string;
  projectId: string;
  targetId: string;
}> = ({ organizationId, projectId, targetId }) => {
  const router = useRouteSelector();
  const [{ data }] = useQuery({
    query: TargetsDocument,
    variables: {
      selector: {
        organization: organizationId,
        project: projectId,
      },
    },
  });

  const currentTarget = React.useMemo(() => {
    return data?.targets.nodes.find(node => node.cleanId === targetId);
  }, [data]);

  const dropdownBgColor = useColorModeValue('white', 'gray.900');
  const dropdownTextColor = useColorModeValue('gray.700', 'gray.300');

  if (!currentTarget || !data?.targets.nodes.length) {
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
        {currentTarget.name}
      </MenuButton>
      <MenuList bg={dropdownBgColor} color={dropdownTextColor}>
        {data.targets.nodes.map(item => {
          return (
            <MenuItem
              onClick={() => {
                router.visitTarget({
                  organizationId,
                  projectId,
                  targetId: item.cleanId,
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
