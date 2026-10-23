import { redirect } from '@tanstack/react-router';
import { doesSessionExist } from './session';

/** `beforeLoad` guard: sends an anonymous visitor to sign-in and back here afterwards. */
export async function requireSession(args: { location: { href: string } }): Promise<void> {
  if (!(await doesSessionExist())) {
    throw redirect({ to: '/auth', search: { redirectToPath: args.location.href } });
  }
}
