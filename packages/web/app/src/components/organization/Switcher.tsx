import React from 'react';
import { useQuery } from 'urql';
import { VscChevronDown, VscAdd } from 'react-icons/vsc';
import {
  Button,
  Menu,
  MenuButton,
  MenuList,
  MenuItem,
  MenuGroup,
  MenuDivider,
  useDisclosure,
  useColorModeValue,
} from '@chakra-ui/react';
import 'twin.macro';
import { OrganizationsDocument, OrganizationType } from '@/graphql';
import { OrganizationCreator } from './Creator';
import { useRouteSelector } from '@/lib/hooks/use-route-selector';

export const OrganizationSwitcher: React.FC<{
  organizationId: string;
}> = ({ organizationId }) => {
  const router = useRouteSelector();
  const [{ data }] = useQuery({
    query: OrganizationsDocument,
  });
  const { isOpen, onOpen, onClose } = useDisclosure();
  const menu = React.useMemo<{
    personal: Array<{
      key: string;
      label: string;
    }>;
    organizations: Array<{
      key: string;
      label: string;
    }>;
  }>(() => {
    if (!data?.organizations?.nodes) {
      return {
        personal: [],
        organizations: [],
      };
    }

    const menu = {
      personal: [],
      organizations: [],
    };

    data.organizations.nodes.forEach(node => {
      if (node.type === OrganizationType.Personal) {
        return menu.personal.push({
          key: node.cleanId,
          label: node.name,
        });
      }

      menu.organizations.push({
        key: node.cleanId,
        label: node.name,
      });
    });

    return menu;
  }, [data]);

  const dropdownBgColor = useColorModeValue('white', 'gray.900');
  const dropdownTextColor = useColorModeValue('gray.700', 'gray.300');

  if (!menu.personal.length) {
    return null;
  }

  const currentOrganization = data.organizations.nodes.find(node => node.cleanId === organizationId);

  return (
    <>
      <OrganizationCreator isOpen={isOpen} onClose={onClose} />
      <Menu autoSelect={false}>
        <MenuButton size="sm" as={Button} rightIcon={<VscChevronDown />} variant="ghost" tw="font-normal">
          {currentOrganization.name}
        </MenuButton>
        <MenuList bg={dropdownBgColor} color={dropdownTextColor}>
          {menu.personal.length && (
            <>
              <MenuGroup title="Personal">
                {menu.personal.map(item => {
                  return (
                    <MenuItem
                      key={item.key}
                      onClick={() => {
                        router.visitOrganization({
                          organizationId: item.key,
                        });
                      }}
                    >
                      {item.label}
                    </MenuItem>
                  );
                })}
              </MenuGroup>
              <MenuDivider />
            </>
          )}
          {menu.organizations.length ? (
            <>
              <MenuGroup title="Organizations">
                {menu.organizations.map(item => {
                  return (
                    <MenuItem
                      key={item.key}
                      onClick={() => {
                        router.visitOrganization({
                          organizationId: item.key,
                        });
                      }}
                    >
                      {item.label}
                    </MenuItem>
                  );
                })}
              </MenuGroup>
              <MenuDivider />
            </>
          ) : null}
          <MenuItem icon={<VscAdd />} onClick={onOpen}>
            Create an Organization
          </MenuItem>
        </MenuList>
      </Menu>
    </>
  );
};
