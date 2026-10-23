import { BookIcon } from 'lucide-react';
import { GitHubIcon, HiveLogo } from '@/components/ui/brand-icon';
import { Meta } from '@/components/ui/meta';
import { useSession } from '@/lib/auth/use-session';
import { Link, Outlet } from '@tanstack/react-router';

function ExternalLink(props: { href: string; children: React.ReactNode }) {
  return (
    <a
      href={props.href}
      className="group relative isolate flex flex-none items-center gap-x-3 rounded-lg px-2 py-0.5 text-control/6 font-medium text-fg-subtle transition-colors hover:text-accent"
    >
      <span className="absolute inset-0 -z-10 scale-75 rounded-lg bg-surface-hover opacity-0 transition group-hover:scale-100 group-hover:opacity-100" />
      {props.children}
    </a>
  );
}

export function AuthPage() {
  const session = useSession();

  return (
    <>
      <Meta title="Welcome" />
      <div className="size-full">
        <>
          {session.loading ? (
            <div className="flex min-h-screen items-center justify-center">
              <HiveLogo animated={false} className="size-8 animate-pulse" />
            </div>
          ) : (
            <div className="grid h-full min-h-screen items-center justify-center md:grid-cols-2 lg:max-w-none lg:grid-cols-3 lg:px-0">
              <div className="relative hidden h-full flex-col border-r border-r-line-subtle bg-surface-card p-10 text-fg lg:flex">
                <div className="absolute inset-0 bg-surface-inset" />
                <Link to="/">
                  <div className="relative z-20 flex items-center text-lg font-medium">
                    <HiveLogo animated={false} className="mr-2 size-6" />
                    Hive Console
                  </div>
                </Link>
                <div className="relative flex h-full flex-row items-center justify-center">
                  <div className="max-w-xs md:max-w-none">
                    <h1 className="font-light text-balance text-fg md:text-2xl/tight lg:text-3xl/tight">
                      Open-source <span className="text-accent">GraphQL</span> management platform
                    </h1>
                    <p className="mt-4 text-sm/6 text-balance text-fg-default">
                      Prevent breaking changes, monitor performance of your GraphQL API, and manage
                      your API gateway
                    </p>
                    <div className="mt-8 flex flex-wrap justify-center gap-x-1 gap-y-3 sm:gap-x-2 lg:justify-start">
                      <ExternalLink href="https://the-guild.dev/graphql/hive/docs">
                        <BookIcon className="size-4 flex-none text-fg-secondary" />
                        <span className="self-baseline text-fg">Documentation</span>
                      </ExternalLink>
                      <ExternalLink href="https://github.com/graphql-hive/platform">
                        <GitHubIcon className="size-4 flex-none text-fg-secondary" />
                        <span className="self-baseline text-fg">Github</span>
                      </ExternalLink>
                    </div>
                  </div>
                </div>
              </div>
              <div className="col-span-2">
                <Outlet />
              </div>
            </div>
          )}
        </>
      </div>
    </>
  );
}
