import { useEffect } from 'react';
import { useRouter } from 'next/router';
import cookies from 'js-cookie';
import { LAST_VISITED_ORG_KEY } from '@/constants';
import { useRouteSelector } from './use-route-selector';

export function useNotFoundRedirectOnError(isError: boolean) {
  const { push } = useRouter();
  const router = useRouteSelector();
  useEffect(() => {
    if (isError) {
      cookies.remove(LAST_VISITED_ORG_KEY);
      // url with # provoke error Maximum update depth exceeded
      void push('/404', router.asPath.replace(/#.*/, ''));
    }
  }, [isError, router]);
}
