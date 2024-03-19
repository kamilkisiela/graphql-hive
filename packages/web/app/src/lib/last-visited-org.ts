import { useEffect } from 'react';
import Cookies from 'js-cookie';
import { LAST_VISITED_ORG_KEY } from '@/constants';

export function useLastVisitedOrganizationWriter(orgId?: string | null) {
  useEffect(() => {
    if (orgId) {
      Cookies.set(LAST_VISITED_ORG_KEY, orgId);
    }
  }, [orgId]);
}
