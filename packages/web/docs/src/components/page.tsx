import { ReactNode } from 'react';
import { CookiesConsent, useMounted } from '@theguild/components';
import { cn } from '../lib';

export function Page(props: { children: ReactNode; className?: string }) {
  const mounted = useMounted();

  return (
    <>
      <div className={cn('flex h-full flex-col', props.className)}>{props.children}</div>
      {mounted && <CookiesConsent />}
    </>
  );
}
