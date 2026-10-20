import { useQuery } from 'urql';
import { TokenExpiration } from '@/components/organization/settings/access-tokens/token-expiration';
import { Sheet } from '@/components/ui/primitives/overlays/sheet/sheet';
import { graphql } from '@/gql';
import { useSlugs } from '@/lib/hooks';
import { useKeepPreviousData } from '@/lib/hooks/use-keep-previous-data';
import { PermissionDetailView } from '../../../organization/settings/access-tokens/permission-detail-view';
import * as styles from './project-access-token-detail-view-sheet.css';

const ProjectAccessTokenDetailViewSheet_OrganizationQuery = graphql(`
  query ProjectAccessTokenDetailViewSheet_OrganizationQuery(
    $organizationSlug: String!
    $projectSlug: String!
    $accessTokenId: ID!
  ) {
    organization: organizationBySlug(organizationSlug: $organizationSlug) {
      id
      slug
      project: projectBySlug(projectSlug: $projectSlug) {
        id
        accessToken(id: $accessTokenId) {
          id
          title
          description
          resolvedResourcePermissionGroups(includeAll: true) {
            title
            ...PermissionDetailView_ResolvedResourcePermissionGroup
          }
          expiresAt
        }
      }
    }
  }
`);

type ProjectAccessTokenDetailViewSheetProps = {
  open: boolean;
  onClose: () => void;
  /** Null while closed; the sheet keeps the last token through its exit transition. */
  accessTokenId: string | null;
};

export function ProjectAccessTokenDetailViewSheet(props: ProjectAccessTokenDetailViewSheetProps) {
  const { organizationSlug, projectSlug } = useSlugs('project');
  const accessTokenId = useKeepPreviousData(
    props.accessTokenId ?? undefined,
    props.accessTokenId === null,
  );
  const [query] = useQuery({
    query: ProjectAccessTokenDetailViewSheet_OrganizationQuery,
    variables: {
      organizationSlug,
      projectSlug,
      accessTokenId: accessTokenId ?? '',
    },
    pause: !accessTokenId,
  });
  const accessToken = query.data?.organization?.project?.accessToken;

  return (
    <Sheet
      open={props.open}
      onOpenChange={props.onClose}
      title={`Access Token: ${accessToken?.title ?? ''}`}
      description={
        <>
          {accessToken?.description}
          <br />
          <span className={styles.projectAccessTokenDetailViewSheetSpan}>Expires:</span>{' '}
          <TokenExpiration expiresAt={accessToken?.expiresAt ?? null} />
        </>
      }
    >
      <div className={styles.projectAccessTokenDetailViewSheetDiv}>
        {accessToken?.resolvedResourcePermissionGroups.map(resolvedResourcePermissionGroup => (
          <PermissionDetailView
            resolvedResourcePermissionGroup={resolvedResourcePermissionGroup}
            key={resolvedResourcePermissionGroup.title}
          />
        ))}
      </div>
    </Sheet>
  );
}
