import { ReactElement, useCallback, useEffect } from 'react';
import Link from 'next/link';
import { format } from 'date-fns/format';
import { Button } from '@/components/ui/button';
import { Popover, PopoverArrow, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useLocalStorage, useToggle } from '@/lib/hooks';
import { cn } from '@/lib/utils';

export type Changelog = {
  title: string;
  description: string;
  href: string;
  route?: string;
  date: string;
};

export function Changelog(props: { changes: Changelog[] }): ReactElement {
  return <ChangelogPopover changes={props.changes} />;
}

function ChangelogPopover(props: { changes: Changelog[] }) {
  const [isOpen, toggle] = useToggle();
  const [displayDot, setDisplayDot] = useLocalStorage<boolean>('hive:changelog:dot', false);
  const [readChanges, setReadChanges] = useLocalStorage<string[]>('hive:changelog:read', []);
  const hasNewChanges = props.changes.some(change => !readChanges.includes(change.href));

  useEffect(() => {
    if (hasNewChanges) {
      setDisplayDot(true);
    }
  }, [hasNewChanges]);

  useEffect(() => {
    if (isOpen) {
      setDisplayDot(false);
    }
  }, [isOpen]);

  const handleChangelogClick = useCallback(
    (item: Changelog) => {
      // Keeps only relevant hrefs in the local storage
      const newReadChanges = [...readChanges, item.href].filter(href =>
        props.changes.some(change => change.href === href),
      );
      setReadChanges(newReadChanges);
    },
    [readChanges, setReadChanges, props.changes],
  );

  return (
    <Popover open={isOpen} onOpenChange={toggle}>
      {props.changes.length > 0 ? (
        <PopoverTrigger>
          <Button variant="outline" className="relative text-sm">
            Latest changes
            {displayDot ? (
              <div className="absolute right-0 top-0 -mr-1 -mt-1 flex size-2">
                <div className="absolute inline-flex size-full animate-pulse rounded-full bg-orange-500" />
              </div>
            ) : null}
          </Button>
        </PopoverTrigger>
      ) : null}
      <PopoverContent className="w-[550px] p-0" collisionPadding={20}>
        <PopoverArrow />
        <div className="grid">
          <div className="space-y-2 p-4">
            <h4 className="font-medium leading-none">What's new in GraphQL Hive</h4>
            <p className="text-muted-foreground text-sm">
              Find out about the newest features, and enhancements
            </p>
          </div>
          <ol className="relative m-0">
            {props.changes.map((change, index) => (
              <li
                className={cn(
                  'border-l-2 pl-4',
                  readChanges.includes(change.href) ? 'border-transparent' : 'border-orange-700',
                )}
                key={index}
              >
                <time
                  className="text-muted-foreground mb-1 text-sm font-normal"
                  dateTime={change.date}
                >
                  {format(new Date(change.date), 'do MMMM yyyy')}
                </time>
                <h3 className="text-pretty text-base font-semibold text-white hover:underline">
                  <Link
                    target="_blank"
                    rel="noopener"
                    onClick={() => handleChangelogClick(change)}
                    href={change.href}
                  >
                    {change.title}
                  </Link>
                </h3>
                <div className="mb-4 mt-1 text-pretty text-sm font-normal text-white/80">
                  {change.description}
                </div>
              </li>
            ))}
          </ol>
        </div>
        <div className="flex flex-row items-center justify-center">
          <Button variant="link" asChild className="text-left text-sm">
            <Link
              rel="noopener noreferrer"
              href="https://the-guild.dev/graphql/hive/product-updates"
              target="_blank"
            >
              View all updates
            </Link>
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
