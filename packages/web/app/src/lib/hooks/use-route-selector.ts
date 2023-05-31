import { useCallback, useMemo } from 'react';
import { useRouter } from 'next/router';

export type Router = ReturnType<typeof useRouteSelector>;

export function useRouteSelector() {
  const router = useRouter();

  const { push } = router;

  const visitHome = useCallback(() => push('/', '/'), [push]);

  const visitOrganization = useCallback(
    ({ organizationId }: { organizationId: string }) => push('/[orgId]', `/${organizationId}`),
    [push],
  );

  const visitProject = useCallback(
    ({ organizationId, projectId }: { organizationId: string; projectId: string }) =>
      push('/[orgId]/[projectId]', `/${organizationId}/${projectId}`),
    [push],
  );

  const visitTarget = useCallback(
    ({
      organizationId,
      projectId,
      targetId,
    }: {
      organizationId: string;
      projectId: string;
      targetId: string;
    }) => push('/[orgId]/[projectId]/[targetId]', `/${organizationId}/${projectId}/${targetId}`),
    [push],
  );

  const update = useCallback(
    (params: Record<string, string | number>) => {
      const routeParams =
        router.route.match(/\[[a-z]+\]/gi)?.map(p => p.replace('[', '').replace(']', '')) ?? [];
      const query = {
        ...router.query,
        ...params,
      };

      const attributes = Object.keys(query).filter(attr => !routeParams.includes(attr));

      const attributesPath = attributes.length
        ? '?' +
          attributes
            .map(attr => (query[attr] ? `${attr}=${query[attr]}` : null))
            .filter(Boolean)
            .join('&')
        : '';

      const route =
        router.route.replace(/\[([a-z]+)\]/gi, (_, param) => router.query[param] as string) +
        attributesPath;

      return push(router.route + attributesPath, route, { shallow: true });
    },
    [router, push],
  );

  const replace = useCallback((url: string) => router.replace(url), [router.replace]);

  // useMemo is necessary because we return new object and on every rerender `router` object will be different
  return useMemo(
    () => ({
      route: router.route,
      asPath: router.asPath,
      query: router.query,
      update,
      push,
      replace,
      visitHome,
      organizationId: router.query.orgId as string,
      visitOrganization,
      projectId: router.query.projectId as string,
      visitProject,
      targetId: router.query.targetId as string,
      visitTarget,
      operationHash: router.query.hash as string,
      versionId: router.query.versionId as string,
    }),
    [router],
  );
}
