import { useMemo } from 'react';
import Link from 'next/link';
import { Tooltip } from '@/components/v2';
import { PackageIcon } from '@/components/v2/icon';
import { FragmentType, graphql, useFragment } from '@/gql';
import { useRouteSelector } from '@/lib/hooks';
import { TooltipProvider } from '@radix-ui/react-tooltip';

function stringToHslColor(str: string, s = 30, l = 80) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }

  const h = hash % 360;
  return 'hsl(' + h + ', ' + s + '%, ' + l + '%)';
}

function SubgraphChip(props: { text: string; tooltip: boolean }): React.ReactElement {
  const router = useRouteSelector();

  const inner = (
    <Link
      href={{
        pathname: '/[organizationId]/[projectId]/[targetId]',
        query: {
          organizationId: router.organizationId,
          projectId: router.projectId,
          targetId: router.targetId,
        },
        hash: `service-${props.text}`,
      }}
      style={{ backgroundColor: stringToHslColor(props.text) }}
      className="my-[2px] ml-[6px] inline-block h-[22px] max-w-[100px] cursor-pointer items-center justify-between truncate rounded-[16px] py-0 pl-[8px] pr-[6px] text-[10px] font-normal normal-case leading-loose text-[#4f4f4f] drop-shadow-md"
    >
      {props.text}
      <PackageIcon size={10} className="ml-1 inline-block" />
    </Link>
  );

  if (!props.tooltip) {
    return inner;
  }

  return (
    <Tooltip
      content={
        <>
          <span className="font-bold">{props.text}</span> subgraph
        </>
      }
    >
      {inner}
    </Tooltip>
  );
}

const SupergraphMetadataList_SupergraphMetadataFragment = graphql(`
  fragment SupergraphMetadataList_SupergraphMetadataFragment on SupergraphMetadata {
    ownedByServiceNames
  }
`);

const tooltipColor = 'rgb(36, 39, 46)';
const previewThreshold = 3;

export function SupergraphMetadataList(props: {
  supergraphMetadata: FragmentType<typeof SupergraphMetadataList_SupergraphMetadataFragment>;
}) {
  const supergraphMetadata = useFragment(
    SupergraphMetadataList_SupergraphMetadataFragment,
    props.supergraphMetadata,
  );

  const items = useMemo(() => {
    if (supergraphMetadata.ownedByServiceNames == null) {
      return null;
    }

    if (supergraphMetadata.ownedByServiceNames.length <= previewThreshold) {
      return [
        supergraphMetadata.ownedByServiceNames.map((serviceName, index) => (
          <SubgraphChip key={`${serviceName}-${index}`} text={serviceName} tooltip />
        )),
        null,
      ] as const;
    }

    return [
      supergraphMetadata.ownedByServiceNames
        .slice(0, previewThreshold)
        .map((serviceName, index) => (
          <SubgraphChip key={`${serviceName}-${index}`} text={serviceName} tooltip />
        )),
      supergraphMetadata.ownedByServiceNames.map((serviceName, index) => (
        <SubgraphChip key={`${serviceName}-${index}`} text={serviceName} tooltip={false} />
      )),
    ] as const;
  }, [supergraphMetadata.ownedByServiceNames]);

  if (items === null) {
    return null;
  }

  const [previewItems, allItems] = items;

  return (
    <TooltipProvider>
      <div className="flex w-full justify-end">
        {previewItems}{' '}
        {allItems ? (
          <Tooltip
            content={
              <>
                <div className="mb-2 font-bold">All Subgraphs</div>
                <div className="relative size-[250px]">
                  <div className="absolute inset-0 size-[250px] overflow-y-scroll py-2">
                    {allItems}
                  </div>
                  <div
                    className="pointer-events-none absolute inset-0"
                    style={{
                      boxShadow: `inset 0px 11px 8px -10px ${tooltipColor}, inset 0px -11px 8px -10px ${tooltipColor}`,
                    }}
                  />
                </div>
              </>
            }
            contentProps={{ className: 'z-10' }}
          >
            <span className="flex cursor-pointer items-center pl-1 text-xs font-bold text-white ">
              + {allItems.length - previewItems.length} more
            </span>
          </Tooltip>
        ) : null}
      </div>
    </TooltipProvider>
  );
}
