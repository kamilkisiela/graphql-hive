import { PropsWithChildren, ReactElement } from 'react';
import Link from 'next/link';
import clsx from 'clsx';
import { FiTarget } from 'react-icons/fi';
import { VscFolder, VscOrganization } from 'react-icons/vsc';
import { useRouteSelector } from '@/lib/hooks';
import { Navigation, NavigationItem, useNavigation } from './Navigation';

const Menu = {
  Title({ children, icon }: { children: string; icon: ReactElement }): ReactElement {
    return (
      <li className="px-3 pb-2">
        <div className="flex flex-row items-center h-8">
          <span className="inline-flex justify-center items-center">{icon}</span>
          <div className="ml-4 text-sm font-semibold text-gray-500 dark:text-gray-300 tracking-wide">
            {children}
          </div>
        </div>
      </li>
    );
  },
  Item(item: NavigationItem & { path: string }) {
    const active = item.exact ? item.path === item.link : item.path.startsWith(item.link);

    return (
      <li>
        <Link href={item.link}>
          <a
            href="#"
            className={clsx(
              `
    relative flex flex-row items-center
    px-3 py-2 min-w-[200px]
    font-semibold
    text-gray-500
    dark:text-gray-400
    hover:text-gray-700
    hover:bg-gray-100
    dark:hover:text-gray-200
    dark:hover:bg-gray-700/25
    rounded-md
`,
              active &&
                `
      text-black hover:text-black
      bg-gray-200 hover:bg-gray-200
      dark:text-white dark:hover:text-white
      dark:bg-gray-700 dark:hover:bg-gray-700
    `,
            )}
          >
            <span className="inline-flex justify-center items-center">{item.icon}</span>
            <span className="ml-4 text-sm tracking-wide truncate font-normal">{item.label}</span>
          </a>
        </Link>
      </li>
    );
  },
};

const WithNavigation = ({ children }: PropsWithChildren) => {
  const navigation = useNavigation();
  const router = useRouteSelector();

  if (!navigation.visible) {
    return <>{children}</>;
  }

  const menuTitle = router.targetId ? 'Target' : router.projectId ? 'Project' : 'Organization';

  const menuIcon = router.targetId ? (
    <FiTarget />
  ) : router.projectId ? (
    <VscFolder />
  ) : (
    <VscOrganization />
  );

  return (
    <div className="flex flex-col flex-1 overflow-y-auto relative">
      <Navigation />
      {navigation.menu ? (
        <div className="flex flex-1 overflow-y-auto text-gray-700 bg-white dark:bg-gray-900">
          <div className="flex-none bg-white dark:bg-gray-800 dark:text-white border-r-2 border-gray-100 dark:border-gray-700">
            <div className="grow">
              <ul className="flex flex-col px-2 py-4">
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
              </ul>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto">{children}</div>
        </div>
      ) : (
        children
      )}
    </div>
  );
};

export const Page = ({ children }: PropsWithChildren) => {
  return <WithNavigation>{children}</WithNavigation>;
};
