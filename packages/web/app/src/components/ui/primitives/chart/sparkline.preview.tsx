import { createPreview, type NavPath } from 'react-foundry';
import { ResourceCard } from '@/components/common/resource-card';
import { week } from './preview-data';

export const nav: NavPath = 'Primitives/Charts/Sparkline';

const BUSY = week(12_000).map(([date, value]) => ({ date, value }));
const QUIET = week(2500, 7).map(([date, value]) => ({ date, value }));

const HIGHEST = Math.max(...BUSY.map(({ value }) => value));

/**
 * A row of project cards. They share `max`, so the quiet project reads as quiet next to the busy
 * one instead of both filling their card.
 */
export const SharedScale = createPreview(() => (
  <div className="grid w-[48rem] grid-cols-2 gap-5">
    {[
      { name: 'gateway', data: BUSY, versions: 12 },
      { name: 'billing', data: QUIET, versions: 3 },
    ].map(project => (
      <ResourceCard
        key={project.name}
        kind="project"
        name={project.name}
        subtitle="Federation"
        renderLink={children => <a href="#">{children}</a>}
        highestNumberOfRequests={HIGHEST}
        requestsOverTime={project.data}
        schemaVersionsCount={project.versions}
        days={7}
      />
    ))}
  </div>
));

/**
 * While loading, the card draws a flat baseline with animation off. The loaded card is a fresh
 * mount, so its data is what animates in: reload Shared Scale and each line draws in once.
 */
export const Loading = createPreview(() => (
  <div className="w-[24rem]">
    <ResourceCard
      kind="project"
      name={null}
      renderLink={children => <a href="#">{children}</a>}
      highestNumberOfRequests={HIGHEST}
      requestsOverTime={null}
      schemaVersionsCount={null}
      days={7}
    />
  </div>
));
