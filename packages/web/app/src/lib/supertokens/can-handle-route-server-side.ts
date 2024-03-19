import { env } from '@/env/backend';

const supertokenRoutes = new Set([
  '/auth/verify-email',
  '/auth/reset-password',
  '/auth/login',
  '/auth',
]);

if (env.auth.github.enabled) {
  supertokenRoutes.add('/auth/callback/github');
}
if (env.auth.google.enabled) {
  supertokenRoutes.add('/auth/callback/google');
}
if (env.auth.okta.enabled) {
  supertokenRoutes.add('/auth/callback/okta');
}
if (env.auth.organizationOIDC) {
  supertokenRoutes.add('/auth/oidc');
  supertokenRoutes.add('/auth/callback/oidc');
}

export function canHandleRouteServerSide(path: string) {
  return supertokenRoutes.has(path);
}
