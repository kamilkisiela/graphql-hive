import React from 'react';
import tw, { styled } from 'twin.macro';
import { AutoSizer } from 'react-virtualized';
import dynamic from 'next/dynamic';
import reactStringReplace from 'react-string-replace';
import { VscBug } from 'react-icons/vsc';
import { CompareQuery } from '@/graphql';
import { Label } from '@/components/common';
import { SchemaChangeFieldsFragment, CriticalityLevel, SchemaCompareResultFieldsFragment } from '@/graphql';
import { Spinner } from '@/components/common/Spinner';

export enum View {
  Diff,
  Text,
}

function labelize(message: string) {
  const findSingleQuotes = /'([^']+)'/gim;

  return reactStringReplace(message, findSingleQuotes, (match, i) => <Label key={i}>{match}</Label>);
}

const GraphQLDiff = dynamic(() => import('@/components/common/GraphQLDiff').then(m => m.GraphQLDiff), {
  loading() {
    return <Spinner />;
  },
});

const ChangeLi = styled.li(({ criticality }: { criticality: CriticalityLevel }) => [
  criticality === CriticalityLevel.Safe
    ? tw`text-emerald-400`
    : criticality === CriticalityLevel.Dangerous
    ? tw`text-yellow-400`
    : tw`text-red-400`,
]);

const ChangesBlock: React.FC<{
  changes: SchemaChangeFieldsFragment[];
  criticality: CriticalityLevel;
}> = ({ changes, criticality }) => {
  const titleMap: Record<CriticalityLevel, string> = {
    Safe: 'Safe Changes',
    Breaking: 'Breaking Changes',
    Dangerous: 'Dangerous Changes',
  };

  const filteredChanges = changes.filter(c => c.criticality === criticality);

  if (!filteredChanges.length) {
    return null;
  }

  return (
    <div>
      <h2 tw="text-gray-900 dark:text-white text-lg font-medium mb-2">{titleMap[criticality]}</h2>
      <ul tw="pl-3 list-disc list-inside leading-relaxed text-base">
        {filteredChanges.map((change, key) => (
          <ChangeLi key={key} criticality={criticality}>
            <span tw="text-gray-600 dark:text-white">{labelize(change.message)}</span>
          </ChangeLi>
        ))}
      </ul>
    </div>
  );
};

const ChangesView: React.FC<{ changes: SchemaChangeFieldsFragment[] }> = ({ changes }) => {
  return (
    <div tw="space-y-3">
      <ChangesBlock changes={changes} criticality={CriticalityLevel.Breaking} />
      <ChangesBlock changes={changes} criticality={CriticalityLevel.Dangerous} />
      <ChangesBlock changes={changes} criticality={CriticalityLevel.Safe} />
    </div>
  );
};

const CompareResult: React.FC<{
  result: SchemaCompareResultFieldsFragment;
  view: View;
}> = ({ result, view }) => {
  return (
    <div tw="h-full">
      {view === View.Diff && (
        <AutoSizer disableWidth>
          {size => <GraphQLDiff before={result.diff.before} after={result.diff.after} height={size.height} />}
        </AutoSizer>
      )}
      {view === View.Text && <ChangesView changes={result.changes.nodes} />}
    </div>
  );
};

const CompareError: React.FC = () => {
  return (
    <div tw="flex rounded-lg bg-red-100 p-8 my-3 mx-3 flex-col">
      <div tw="flex items-center mb-3">
        <VscBug tw="w-8 h-8 text-red-500 mr-3" />
        <h2 tw="text-gray-900 text-lg font-medium">Failed to build GraphQL Schema</h2>
      </div>
      <div tw="flex-grow">
        <p tw="leading-relaxed text-base">Schema is most likely incomplete and was force published</p>
      </div>
    </div>
  );
};

export const Compare: React.FC<{
  view: View;
  comparison: CompareQuery['schemaCompareToPrevious'];
}> = ({ comparison, view }) => {
  if (comparison.__typename === 'SchemaCompareError') {
    // TODO: add "Mark as valid" here as well
    return <CompareError />;
  }

  return <CompareResult view={view} result={comparison} />;
};
