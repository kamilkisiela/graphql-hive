import { ReactElement, ReactNode } from 'react';
import { CodeScrollArea, File } from '@/components/ui/diffs';
import { Card } from '@/components/ui/primitives/card/card';
import { usePrettify } from '@/lib/hooks';
import { Heading } from './heading';

/** A read-only, highlighted GraphQL document: SDL or an operation. */
export function GraphQLHighlight(props: { code: string; className?: string }): ReactElement {
  const pretty = usePrettify(props.code);

  return (
    <CodeScrollArea className={props.className}>
      <div className="max-w-[inherit]">
        <File
          file={{ name: 'document.graphql', contents: pretty ?? '' }}
          options={{ disableFileHeader: true }}
        />
      </div>
    </CodeScrollArea>
  );
}

export function GraphQLBlock({
  sdl,
  title,
  url,
  className,
}: {
  sdl: string;
  title?: string | ReactNode;
  url?: string;
  className?: string;
}): ReactElement {
  return (
    <div className={className}>
      <Card variants={{ onSurface: 'base' }}>
        <Heading className="mb-4">
          {title ?? 'SDL'}
          {url && <span className="ml-3 text-sm italic">{url}</span>}
        </Heading>
        <div className="pb-2">
          <GraphQLHighlight code={sdl} />
        </div>
      </Card>
    </div>
  );
}
