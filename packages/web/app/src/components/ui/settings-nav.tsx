import { cn } from '@/lib/utils';

type NavItem = {
  icon: React.ReactNode;
  title: string;
};

export type NavState = 'General' | 'Token' | 'Schema';

const SettingItem = ({
  icon,
  title,
  selected,
  onClick,
}: NavItem & { selected: boolean; onClick: () => void }) => {
  return (
    <div className="flex  flex-row justify-start">
      <div className="flex w-[100px] flex-col justify-start bg-transparent text-base md:w-[250px]">
        <nav className="grid gap-2 pr-2">
          <div
            onClick={onClick}
            className={cn(
              'flex cursor-pointer flex-row justify-start gap-3 rounded p-1 font-semibold text-white hover:bg-yellow-800',
              selected ? 'bg-gray-800' : 'bg-transparent',
            )}
          >
            <div className="hidden md:block">{icon}</div>
            <div>{title}</div>
          </div>
        </nav>
      </div>
    </div>
  );
};

const NavItems: NavItem[] = [
  {
    icon: <span>🔒</span>,
    title: 'General',
  },
  {
    icon: <span>🔑</span>,
    title: 'Token',
  },
  {
    icon: <span>📦</span>,
    title: 'Schema',
  },
];

type SettingLayoutProps = {
  children: React.ReactNode;
  selectedTab: NavState;
  setSelectedTab: (tab: NavState) => void;
};

export const SettingLayout = ({ children, selectedTab, setSelectedTab }: SettingLayoutProps) => {
  const handleTabClick = (tab: NavState) => {
    setSelectedTab(tab);
  };

  return (
    <div className="flex w-full flex-row">
      <div className="flex w-[100px] flex-col justify-start bg-transparent text-base md:w-[250px]">
        <nav className="grid gap-2 pr-2">
          {NavItems.map(link => (
            <SettingItem
              key={link.title}
              icon={link.icon}
              title={link.title}
              selected={selectedTab === link.title}
              onClick={() => handleTabClick(link.title as NavState)}
            />
          ))}
        </nav>
      </div>
      <div className="ml-7 flex w-full flex-col justify-start bg-transparent text-white">
        {children}
      </div>
    </div>
  );
};
