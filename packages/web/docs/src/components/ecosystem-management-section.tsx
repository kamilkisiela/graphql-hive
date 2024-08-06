import { CallToAction } from './call-to-action';
import { CheckIcon } from './CheckIcon';
import { HighlightDecoration } from './decorations';
import { Heading } from './heading';

export function EcosystemManagementSection() {
  return (
    <section
      className={
        'bg-green-1000 relative mx-1 grid grid-cols-1 gap-x-[120px] overflow-hidden rounded-3xl text-white md:mx-6 md:grid-cols-2' +
        ' p-4 md:p-[72px]'
      }
    >
      <div className="flex flex-col gap-12">
        <Heading as="h3" size="md">
          360° GraphQL Ecosystem Management
        </Heading>
        <ul className="mx-auto flex list-none flex-col gap-y-2 text-sm text-white [&>li]:flex [&>li]:items-center [&>li]:gap-2">
          <li>
            <CheckIcon className="text-blue-400" />
            Fully open-source
          </li>
          <li>
            <CheckIcon className="text-blue-400" />
            No vendor lock
          </li>
          <li>
            <CheckIcon className="text-blue-400" />
            Can be self-hosted!
          </li>
        </ul>
        <HighlightDecoration className="pointer-events-none absolute right-0 top-[-22px] overflow-visible" />
      </div>
      <div>
        <CallToAction>
          Migrate to Apollo
        </CallToAction>
      </div>
      <div>{/*  */}</div>
    </section>
  );
}
