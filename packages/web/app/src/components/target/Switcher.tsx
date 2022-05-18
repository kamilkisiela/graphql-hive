import React from 'react';
import { useQuery } from 'urql';
import { useColorModeValue } from '@chakra-ui/react';
import 'twin.macro';
import { VscChevronDown } from 'react-icons/vsc';
import { Button, Menu, MenuButton, MenuList, MenuItem } from '@chakra-ui/react';
import { TargetsDocument } from '@/graphql';
import { useRouteSelector } from '@/lib/hooks/use-route-selector';

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
  const items = React.useMemo(() => {
    if (!data?.targets?.nodes) {
      return [];
    }

    return data.targets.nodes.map((node) => ({
      key: node.cleanId,
      label: node.name,
    }));
  }, [data]);

  const dropdownBgColor = useColorModeValue('white', 'gray.900');
  const dropdownTextColor = useColorModeValue('gray.700', 'gray.300');

  if (!items.length) {
    return null;
  }

  const currentTarget = data.targets.nodes.find(
    (node) => node.cleanId === targetId
  );

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
        {items.map((item) => {
          return (
            <MenuItem
              onClick={() => {
                router.visitTarget({
                  organizationId,
                  projectId,
                  targetId: item.key,
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
