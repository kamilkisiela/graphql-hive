import { env } from '@/env/backend';

const supertokenRoutes = new Set([
  '/auth/verify-email',
  '/auth/reset-password',
  '/auth/login',
  '/auth',
]);

if (env.auth.github) {
  supertokenRoutes.add('/auth/callback/github');
}
if (env.auth.google) {
  supertokenRoutes.add('/auth/callback/google');
}
if (env.auth.okta) {
  supertokenRoutes.add('/auth/callback/okta');
}
if (env.auth.github) {
  supertokenRoutes.add('/auth/callback/github');
}
if (env.auth.organizationOIDC) {
  supertokenRoutes.add('/auth/oidc');
}

export function canHandleRouteServerSide(path: string) {
  return supertokenRoutes.has(path);
}
