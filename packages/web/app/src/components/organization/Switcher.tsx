import React from 'react';
import { VscAdd, VscChevronDown } from 'react-icons/vsc';
import { useQuery } from 'urql';
import { OrganizationsDocument, OrganizationsQuery, OrganizationType } from '@/graphql';
import { useRouteSelector } from '@/lib/hooks';
import {
  Button,
  Menu,
  MenuButton,
  MenuDivider,
  MenuGroup,
  MenuItem,
  MenuList,
  useColorModeValue,
  useDisclosure,
} from '@chakra-ui/react';
import { OrganizationCreator } from './Creator';

export const OrganizationSwitcher: React.FC<{
  organizationId: string;
}> = ({ organizationId }) => {
  const router = useRouteSelector();
  const [{ data }] = useQuery({
    query: OrganizationsDocument,
  });
  const { isOpen, onOpen, onClose } = useDisclosure();
  const menu = React.useMemo(() => {
    if (!data?.organizations?.nodes) {
      return null;
    }

    const personal: Array<{ key: string; label: string }> = [];
    const organizations: Array<{ key: string; label: string }> = [];
    let currentOrganization: null | OrganizationsQuery['organizations']['nodes'][number] = null;

    for (const node of data.organizations.nodes) {
      if (node.cleanId === organizationId) {
        currentOrganization = node;
      }
      if (node.type === OrganizationType.Personal) {
        personal.push({
          key: node.cleanId,
          label: node.name,
        });
        continue;
      }

      organizations.push({
        key: node.cleanId,
        label: node.name,
      });
    }

    if (currentOrganization === null) {
      return null;
    }

    return {
      personal,
      organizations,
      currentOrganization,
    };
  }, [data]);

  const dropdownBgColor = useColorModeValue('white', 'gray.900');
  const dropdownTextColor = useColorModeValue('gray.700', 'gray.300');

  if (!menu) {
    return null;
  }

  return (
    <>
      <OrganizationCreator isOpen={isOpen} onClose={onClose} />
      <Menu autoSelect={false}>
        <MenuButton
          size="sm"
          as={Button}
          rightIcon={<VscChevronDown />}
          variant="ghost"
          className="font-normal"
        >
          {menu.currentOrganization.name}
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
