import React from 'react';
import { track } from '@/lib/mixpanel';
import { useRouter } from 'next/router';

export type Router = ReturnType<typeof useRouteSelector>;

export function useRouteSelector() {
  const router = useRouter();

  const push = React.useCallback(
    (
      route: string,
      as: string,
      options?: {
        shallow?: boolean;
      }
    ) => {
      track('PAGE_VIEW', {
        route,
        as,
      });
      router.push(route, as, options);
    },
    [router]
  );

  const visitHome = React.useCallback(() => {
    push(`/`, '/');
  }, [push]);
  const visitOrganization = React.useCallback(
    ({ organizationId }: { organizationId: string }) => {
      push('/[orgId]', `/${organizationId}`);
    },
    [push]
  );
  const visitProject = React.useCallback(
    ({
      organizationId,
      projectId,
    }: {
      organizationId: string;
      projectId: string;
    }) => {
      push('/[orgId]/[projectId]', `/${organizationId}/${projectId}`);
    },
    [push]
  );
  const visitTarget = React.useCallback(
    ({
      organizationId,
      projectId,
      targetId,
    }: {
      organizationId: string;
      projectId: string;
      targetId: string;
    }) => {
      push(
        '/[orgId]/[projectId]/[targetId]',
        `/${organizationId}/${projectId}/${targetId}`
      );
    },
    [push]
  );

  const update = React.useCallback(
    (params: Record<string, string | number>) => {
      const routeParams = router.route
        .match(/\[[a-z]+\]/gi)
        .map((p) => p.replace('[', '').replace(']', ''));
      const query = {
        ...router.query,
        ...params,
      };

      const attributes = Object.keys(query).filter(
        (attr) => !routeParams.includes(attr)
      );

      const attributesPath = attributes.length
        ? '?' +
          attributes
            .map((attr) => (query[attr] ? `${attr}=${query[attr]}` : null))
            .filter(Boolean)
            .join('&')
        : '';

      const route =
        router.route.replace(
          /\[([a-z]+)\]/gi,
          (_, param) => router.query[param] as string
        ) + attributesPath;

      push(router.route + attributesPath, route, { shallow: true });
    },
    [router, push]
  );

  return {
    route: router.route,
    asPath: router.asPath,
    query: router.query,
    update,
    push,
    visitHome,
    organizationId: router.query.orgId as string,
    visitOrganization,
    projectId: router.query.projectId as string,
    visitProject,
    targetId: router.query.targetId as string,
    visitTarget,
    operationHash: router.query.hash as string,
    versionId: router.query.versionId as string,
  };
}
