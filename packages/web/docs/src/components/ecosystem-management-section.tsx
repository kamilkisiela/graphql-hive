import { CheckIcon } from './CheckIcon';
import { HighlightDecoration } from './decorations';
import { Heading } from './heading';

export function EcosystemManagementSection() {
  return (
    <section className="bg-green-1000 relative mx-1 overflow-hidden rounded-3xl pb-52 pt-24 text-white md:mx-6">
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
    </section>
  );
}
