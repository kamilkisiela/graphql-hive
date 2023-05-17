import Link from 'next/link';
import { Tooltip } from '@/components/v2';
import { PackageIcon } from '@/components/v2/icon';
import { FragmentType, graphql, useFragment } from '@/gql';
import { useRouteSelector } from '@/lib/hooks';

function stringToHslColor(str: string, s = 30, l = 80) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }

  const h = hash % 360;
  return 'hsl(' + h + ', ' + s + '%, ' + l + '%)';
}

function SubgraphChip(props: { text: string }): React.ReactElement {
  const router = useRouteSelector();

  return (
    <Tooltip
      content={
        <>
          <span className="font-bold">{props.text}</span> subgraph
        </>
      }
    >
      <Link
        href={`/${router.organizationId}/${router.projectId}/${router.targetId}#${props.text}`}
        style={{ backgroundColor: stringToHslColor(props.text) }}
        className="my-[2px] ml-[6px] h-[24px] cursor-pointer items-center justify-between rounded-[16px] pl-[6px] pr-[8px] py-0 text-[12px] font-normal normal-case leading-loose text-[#4f4f4f] inline-block"
      >
        <PackageIcon size={12} className="inline-block mr-1" />
        {props.text}
      </Link>
    </Tooltip>
  );
}

const SupergraphMetadataList_SupergraphMetadataFragment = graphql(`
  fragment SupergraphMetadataList_SupergraphMetadataFragment on SupergraphMetadata {
    ownedByServiceNames
  }
`);

export function SupergraphMetadataList(props: {
  supergraphMetadata: FragmentType<typeof SupergraphMetadataList_SupergraphMetadataFragment>;
}) {
  const supergraphMetadata = useFragment(
    SupergraphMetadataList_SupergraphMetadataFragment,
    props.supergraphMetadata,
  );
  return supergraphMetadata.ownedByServiceNames ? (
    <div className="w-full flex justify-end">
      {supergraphMetadata.ownedByServiceNames.map(serviceName => (
        <SubgraphChip key={serviceName} text={serviceName} />
      ))}
    </div>
  ) : null;
}
