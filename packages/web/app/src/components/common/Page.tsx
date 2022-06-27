import React, { ReactElement } from 'react';
import tw, { styled } from 'twin.macro';
import Link from 'next/link';
import { FiTarget } from 'react-icons/fi';
import { VscOrganization, VscFolder } from 'react-icons/vsc';
import { useNavigation, Navigation, NavigationItem } from './Navigation';
import { useRouteSelector } from '@/lib/hooks/use-route-selector';

const PageContainer = tw.div`flex flex-col flex-1 overflow-y-auto relative`;

const Container = tw.div`flex flex-1 overflow-y-auto text-gray-700 bg-white dark:bg-gray-900`;
const Fixed = tw.div`flex-none bg-white dark:bg-gray-800 dark:text-white border-r-2 border-gray-100 dark:border-gray-700`;
const Grow = tw.div`flex-grow`;
const Content = tw.div`flex-1 overflow-y-auto`;

const MenuLink = styled.a(({ active }: { active?: boolean }) => [
  tw`
    relative flex flex-row items-center
    px-3 py-2 min-width[200px]
    font-semibold
    text-gray-500
    dark:text-gray-400
    hover:text-gray-700
    hover:bg-gray-100
    dark:hover:text-gray-200
    dark:hover:bg-gray-700
    dark:hover:bg-opacity-25
    rounded-md
`,
  active
    ? tw`
      text-black hover:text-black
      bg-gray-200 hover:bg-gray-200
      dark:text-white dark:hover:text-white
      dark:bg-gray-700 dark:hover:bg-gray-700
    `
    : tw``,
]);

const Menu = {
  Root: tw.ul`flex flex-col px-2 py-4`,
  Title: ({ children, icon }: { children: string; icon: ReactElement }) => {
    return (
      <li tw="px-3 pb-2">
        <div tw="flex flex-row items-center h-8">
          <span tw="inline-flex justify-center items-center">{icon}</span>
          <div tw="ml-4 text-sm font-semibold text-gray-500 dark:text-gray-300 tracking-wide">{children}</div>
        </div>
      </li>
    );
  },
  Item: (item: NavigationItem & { path: string }) => {
    const active = item.exact ? item.path === item.link : item.path.startsWith(item.link);

    return (
      <li>
        <Link href={item.link}>
          <MenuLink href="#" active={active}>
            <span tw="inline-flex justify-center items-center">{item.icon}</span>
            <span tw="ml-4 text-sm tracking-wide truncate font-normal">{item.label}</span>
          </MenuLink>
        </Link>
      </li>
    );
  },
};

const WithNavigation: React.FC<{}> = ({ children }) => {
  const navigation = useNavigation();
  const router = useRouteSelector();

  if (!navigation.visible) {
    return <>{children}</>;
  }

  const menuTitle = router.targetId ? `Target` : router.projectId ? `Project` : 'Organization';

  const menuIcon = router.targetId ? <FiTarget /> : router.projectId ? <VscFolder /> : <VscOrganization />;

  return (
    <PageContainer>
      <Navigation />
      {navigation.menu ? (
        <Container>
          <Fixed>
            <Grow>
              <Menu.Root>
                <Menu.Title icon={menuIcon}>{menuTitle}</Menu.Title>
                {navigation.menu.filter(Boolean).map((item, key) => (
                  <Menu.Item
                    key={key}
                    label={item.label}
                    link={item.link}
                    icon={item.icon}
                    exact={item.exact}
                    path={router.asPath}
                  />
                ))}
              </Menu.Root>
            </Grow>
          </Fixed>
          <Content>{children}</Content>
        </Container>
      ) : (
        children
      )}
    </PageContainer>
  );
};

export const Page: React.FC = ({ children }) => {
  return <WithNavigation>{children}</WithNavigation>;
};
