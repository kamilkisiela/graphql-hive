import 'twin.macro';
import * as React from 'react';
import Link from 'next/link';
import {
  Button,
  Divider,
  Link as ChakraLink,
  Menu,
  MenuButton,
  MenuItem,
  MenuList,
  useColorModeValue,
  useDisclosure,
} from '@chakra-ui/react';
import { useQuery } from 'urql';
import { env } from '@/env/frontend';
import { MeDocument } from '@/graphql';
import { getDocsUrl } from '@/lib/docs-url';
import { OrganizationSwitcher } from '../organization/Switcher';
import { ProjectSwitcher } from '../project/Switcher';
import { TargetSwitcher } from '../target/Switcher';
import { Feedback } from './Feedback';
import { Logo } from './Logo';
import ThemeButton from './ThemeButton';
import { UserSettings } from './UserSettings';

export interface NavigationItem {
  label: string;
  link: string;
  icon: React.ReactNode;
  exact?: boolean;
}

interface State {
  organization?: string;
  project?: string;
  target?: string;
  menuTitle?: string;
  menu?: NavigationItem[];
}

const NavigationContext = React.createContext<{
  organization?: string;
  project?: string;
  target?: string;
  menuTitle?: string;
  menu?: NavigationItem[];
  visible?: boolean;
  setNavigation: (state: State) => void;
  show(): void;
  hide(): void;
}>({
  organization: undefined,
  project: undefined,
  target: undefined,
  menuTitle: undefined,
  menu: undefined,
  visible: false,
  setNavigation: () => {},
  show() {},
  hide() {},
});

export const useNavigation = () => React.useContext(NavigationContext);

export const NavigationProvider = ({ children }: { children: React.ReactNode }) => {
  const [state, setState] = React.useState<State>({});
  const [visible, setVisible] = React.useState<boolean>(true);
  const show = React.useCallback(() => setVisible(true), [setVisible]);
  const hide = React.useCallback(() => setVisible(false), [setVisible]);
  const setNavigation = React.useCallback(
    (state: State) => {
      setState(state);
      show();
    },
    [show, setState],
  );

  return (
    <NavigationContext.Provider
      value={{
        organization: state.organization,
        project: state.project,
        target: state.target,
        menu: state.menu,
        menuTitle: state.menuTitle,
        visible,
        setNavigation,
        show,
        hide,
      }}
    >
      {children}
    </NavigationContext.Provider>
  );
};

export function Navigation() {
  const { organization, project, target, visible } = useNavigation();
  const feedback = useDisclosure();
  const settings = useDisclosure();
  const [meQuery] = useQuery({
    query: MeDocument,
  });

  const dropdownBgColor = useColorModeValue('white', 'gray.900');
  const dropdownTextColor = useColorModeValue('gray.700', 'gray.300');

  if (!visible) {
    return null;
  }

  const me = meQuery.data?.me;

  const docsUrl = getDocsUrl();

  return (
    <nav tw="bg-white shadow-md dark:bg-gray-900 z-10">
      <div tw="mx-auto px-2 sm:px-6 lg:px-8">
        <div tw="relative flex flex-row items-center justify-between h-12">
          <div tw="flex-1 flex items-center justify-center sm:items-stretch sm:justify-start">
            <Link href="/" tw="flex-shrink-0 flex text-yellow-500 items-center hover:opacity-50">
              <Logo tw="w-6 h-6" />
            </Link>
            <div tw="hidden sm:block sm:ml-6">
              <div tw="flex space-x-4 items-center ">
                {organization && <OrganizationSwitcher organizationId={organization} />}
                {project && organization && (
                  <>
                    <div tw="text-xl text-gray-200 font-normal select-none">/</div>
                    <ProjectSwitcher organizationId={organization} projectId={project} />
                  </>
                )}
                {project && target && organization && (
                  <>
                    <div tw="text-xl text-gray-200 font-normal select-none">/</div>
                    <TargetSwitcher
                      organizationId={organization}
                      projectId={project}
                      targetId={target}
                    />
                  </>
                )}
              </div>
            </div>
          </div>
          {docsUrl ? (
            <div tw="flex flex-row items-center space-x-4">
              <ChakraLink tw="text-sm dark:text-gray-200" href={docsUrl}>
                Documentation
              </ChakraLink>
            </div>
          ) : null}
          <Divider orientation="vertical" tw="height[20px] ml-8 mr-3" />
          <div tw="inset-y-0 right-0 flex items-center pr-2 sm:static sm:inset-auto sm:pr-0">
            <div tw="ml-3 relative">
              <Menu autoSelect={false}>
                <MenuButton
                  size="sm"
                  as={Button}
                  tw="font-normal"
                  variant="ghost"
                  rightIcon={
                    <img
                      tw="h-6 w-6 rounded-full"
                      src={undefined}
                      alt={me?.displayName ?? undefined}
                    />
                  }
                >
                  {me?.displayName}
                </MenuButton>
                <MenuList bg={dropdownBgColor} color={dropdownTextColor}>
                  {me && (
                    <>
                      <MenuItem onClick={settings.onOpen}>Settings</MenuItem>
                      <UserSettings me={me} isOpen={settings.isOpen} onClose={settings.onClose} />
                    </>
                  )}
                  <MenuItem as="a" href="https://calendly.com/d/zjjt-g8zd/hive-feedback">
                    Schedule a meeting
                  </MenuItem>
                  <MenuItem onClick={feedback.onOpen}>Give feedback</MenuItem>
                  <Feedback isOpen={feedback.isOpen} onClose={feedback.onClose} />
                  <MenuItem
                    onClick={() => {
                      if (typeof window !== 'undefined' && (window as any).$crisp) {
                        (window as any).$crisp.push(['do', 'chat:open']);
                      }
                    }}
                  >
                    Support
                  </MenuItem>
                  {env.nodeEnv === 'development' ? (
                    <MenuItem
                      onClick={() => {
                        window.location.href = '/dev';
                      }}
                    >
                      GraphiQL
                    </MenuItem>
                  ) : null}
                  <MenuItem
                    onClick={() => {
                      window.location.href = '/api/logout';
                    }}
                  >
                    Logout
                  </MenuItem>
                </MenuList>
              </Menu>
            </div>
          </div>
          <ThemeButton />
          <div className="hive-release-notes" />
        </div>
      </div>
    </nav>
  );
}
