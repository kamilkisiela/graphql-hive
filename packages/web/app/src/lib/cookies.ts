import Cookies from 'cookies';
import { LAST_VISITED_ORG_KEY } from '@/constants';

export function writeLastVisitedOrganization(req: any, res: any, orgId: string): void {
  const cookies = new Cookies(req, res);
  cookies.set(LAST_VISITED_ORG_KEY, orgId, {
    httpOnly: false,
  });
}
