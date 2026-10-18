import { controlsFor, createPreview, type NavPath } from 'react-foundry';
import { SingleSignOnLoadingSkeleton } from '@/components/organization/settings/single-sign-on/single-sign-on-loading-skeleton';
import { Skeleton } from './skeleton';

export const nav: NavPath = 'Primitives/Skeleton';

export const Shapes = createPreview(() => (
  <div className="flex items-end gap-8 text-xs text-fg-secondary">
    <span className="flex flex-col gap-2">
      <Skeleton />
      line
    </span>
    <span className="flex flex-col gap-2">
      <span className="block h-16 w-32">
        <Skeleton variants={{ shape: 'block' }} />
      </span>
      block
    </span>
    <span className="flex flex-col items-center gap-2">
      <Skeleton variants={{ shape: 'circle' }} />
      circle
    </span>
  </div>
));

export const LineSizes = createPreview(() => (
  <div className="flex flex-col gap-3 text-xs text-fg-secondary">
    {(['xs', 'sm', 'default', 'lg', 'xl'] as const).map(size => (
      <span key={size} className="flex items-center gap-4">
        <span className="w-14">{size}</span>
        <Skeleton variants={{ size }} />
      </span>
    ))}
  </div>
));

export const LineWidths = createPreview(() => (
  <div className="flex w-[32rem] flex-col gap-3 text-xs text-fg-secondary">
    {(['xs', 'sm', 'md', 'lg', 'xl', 'full'] as const).map(width => (
      <span key={width} className="flex items-center gap-4">
        <span className="w-14 shrink-0">{width}</span>
        <Skeleton variants={{ width }} />
      </span>
    ))}
  </div>
));

export const SettingsSections = createPreview(() => (
  <div className="max-w-[800px] space-y-4">
    <SingleSignOnLoadingSkeleton />
  </div>
));

export const Playground = createPreview({
  controls: controlsFor(Skeleton, {
    variants: {
      shape: { type: 'radio', options: ['line', 'block', 'circle'], default: 'line' },
      size: { type: 'radio', options: ['xs', 'sm', 'default', 'lg', 'xl'], default: 'default' },
      width: { type: 'radio', options: ['xs', 'sm', 'md', 'lg', 'xl', 'full'], default: 'md' },
    },
  }),
  render: v => (
    <span className="block h-24 w-64">
      <Skeleton variants={v.variants} />
    </span>
  ),
});
