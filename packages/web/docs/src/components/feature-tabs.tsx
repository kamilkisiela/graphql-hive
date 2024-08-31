import { ReactNode, useState } from 'react';
import Head from 'next/head';
import Image, { StaticImageData } from 'next/image';
import { ChevronDownIcon } from '@radix-ui/react-icons';
import * as Tabs from '@radix-ui/react-tabs';
import { CallToAction } from '@theguild/components';
import { cn } from '../lib';
import { ArrowIcon } from './arrow-icon';
import { Heading } from './heading';
import { Stud } from './stud';
import observabilityClientsImage from '../../public/features/observability/clients.png';
import observabilityOperationsImage from '../../public/features/observability/operations.png';
import observabilityOverallImage from '../../public/features/observability/overall.png';
import registryExplorerImage from '../../public/features/registry/explorer.png';
import registrySchemaChecksImage from '../../public/features/registry/schema-checks.png';
import registryVersionControlSystemImage from '../../public/features/registry/version-control-system.png';

export function FeatureTabs({ className }: { className?: string }) {
  const tabs = ['Schema Registry', 'GraphQL Observability', 'Schema Management'];
  const icons = [<SchemaRegistryIcon />, <GraphQLObservabilityIcon />, <SchemaManagementIcon />];

  return (
    <section
      className={cn(
        'border-beige-400 mx-auto w-[1200px] max-w-full rounded-3xl bg-white' +
          ' sm:max-w-[calc(100%-4rem)] sm:border md:p-6',
        className,
      )}
    >
      <Head>
        {[
          observabilityClientsImage,
          observabilityOperationsImage,
          observabilityOverallImage,
          registryExplorerImage,
          registrySchemaChecksImage,
          registryVersionControlSystemImage,
        ].map(image => (
          <link key={image.src} rel="preload" as="image" href={image.src} />
        ))}
      </Head>
      <Tabs.Root defaultValue={tabs[0]} {...useSmallScreenTabsHandlers()}>
        <Tabs.List
          className={
            'sm:bg-beige-200 mb-12 flex flex-col sm:flex-row sm:rounded-2xl' +
            ' group mx-4 mt-6 md:mx-0 md:mt-0' +
            ' max-sm:h-[58px] max-sm:focus-within:rounded-b-none' +
            ' max-sm:focus-within:pointer-events-none' + // <- blur on click of current
            ' max-sm:focus-within:has-[>:nth-child(2)[data-state="active"]]:translate-y-[-100%]' +
            ' max-sm:focus-within:has-[>:nth-child(3)[data-state="active"]]:translate-y-[-200%]' +
            ' relative z-10 overflow-hidden focus-within:overflow-visible'
          }
        >
          {tabs.map((tab, i) => {
            return (
              <Tabs.Trigger
                key={tab}
                value={tab}
                className={
                  'rdx-state-active:text-green-1000 rdx-state-active:border-beige-600 rdx-state-active:bg-white' +
                  ' border-transparent font-medium leading-6 text-green-800 sm:border' +
                  ' flex flex-1 justify-center gap-2.5 p-4' +
                  ' text-base sm:text-sm lg:text-base [&>svg]:shrink-0' +
                  ' max-sm:rdx-state-inactive:hidden group-focus-within:rdx-state-inactive:flex [&[data-state="inactive"]>:last-child]:invisible' +
                  ' rounded-lg sm:rounded-[15px]' +
                  ' max-sm:bg-beige-200 max-sm:rdx-state-inactive:rounded-none z-10' +
                  ' max-sm:border-beige-600 max-sm:group-focus-within:rdx-state-inactive:border-y-beige-200 max-sm:border' +
                  ' max-sm:group-focus-within:[&:last-child]:border-t-beige-200 max-sm:group-focus-within:[&:nth-child(3)]:rounded-t-none' +
                  ' max-sm:group-focus-within:[&[data-state="inactive"]:first-child]:border-t-beige-600 max-sm:group-focus-within:[&[data-state="inactive"]:first-child]:rounded-t-lg' +
                  ' max-sm:group-focus-within:[&:nth-child(2)]:rdx-state-active:rounded-none max-sm:group-focus-within:[&:nth-child(2)]:rdx-state-active:border-y-beige-200' +
                  ' max-sm:group-focus-within:[[data-state="active"]+&:last-child]:border-b-beige-600 max-sm:group-focus-within:[[data-state="active"]+&:last-child]:rounded-b-lg' +
                  ' max-sm:group-focus-within:[[data-state="inactive"]+&:last-child[data-state="inactive"]]:border-b-beige-600 max-sm:group-focus-within:[[data-state="inactive"]+&:last-child[data-state="inactive"]]:rounded-b-lg' +
                  ' max-sm:group-focus-within:first:rdx-state-active:border-b-beige-200 max-sm:group-focus-within:first:rdx-state-active:rounded-b-none' +
                  ' max-sm:group-focus-within:aria-selected:z-20 max-sm:group-focus-within:aria-selected:ring-4' +
                  ' max-sm:rdx-state-inactive:pointer-events-none max-sm:rdx-state-inactive:group-focus-within:pointer-events-auto' +
                  // between 640px and 721px we still want tabs, but they won't fit with big padding
                  ' sm:max-[721px]:p-2'
                }
              >
                {icons[i]}
                {tab}
                <ChevronDownIcon className="ml-auto size-6 text-green-800 transition group-focus-within:rotate-90 sm:hidden" />
              </Tabs.Trigger>
            );
          })}
        </Tabs.List>
        <Tabs.Content value="Schema Registry" tabIndex={-1}>
          <Feature
            title="Schema Registry"
            icon={<SchemaRegistryIcon />}
            documentationLink="/docs/features/schema-registry"
            description="A comprehensive Schema Registry to track and manage all changes in your GraphQL schemas."
            highlights={[
              {
                title: 'Version Control System',
                description:
                  'Track modifications precisely across multiple environments from staging to production.',
                image: registryVersionControlSystemImage,
              },
              {
                title: 'Schema Checks',
                description:
                  'Enhance reliability in consumer apps with proactive detection for smooth API evolution.',
                image: registrySchemaChecksImage,
              },
              {
                title: 'Composition Error Prevention',
                description:
                  'Safeguard your gateway’s operation, preventing systemic failures that could halt your enterprise processes.',
                image: registrySchemaChecksImage, // TODO: Replace with correct image
              },
              {
                title: 'Schema Explorer',
                description: 'Navigate and analyze the connections within your GraphQL schema.',
                image: registryExplorerImage,
              },
            ]}
          />
        </Tabs.Content>
        <Tabs.Content value="GraphQL Observability" tabIndex={-1}>
          <Feature
            title="GraphQL Observability"
            icon={<GraphQLObservabilityIcon />}
            documentationLink="/docs/features/usage-reporting"
            description="Enhanced GraphQL Observability tools provide insights into API usage and user experience metrics."
            highlights={[
              {
                title: 'GraphQL consumers',
                description:
                  'Track each GraphQL request source to monitor how the APIs are utilized, optimizing resource management.',
                image: observabilityClientsImage,
              },
              {
                title: 'Overall performance',
                description: 'Global dashboard for an overarching view of your GraphQL API usage.',
                image: observabilityOverallImage,
              },
              {
                title: 'Query performance',
                description:
                  'Identify and analyze slow GraphQL operations to pinpoint performance bottlenecks.',
                image: observabilityOperationsImage,
              },
            ]}
          />
        </Tabs.Content>
        <Tabs.Content value="Schema Management" tabIndex={-1}>
          <Feature
            title="Schema Management"
            icon={<SchemaManagementIcon />}
            description="Optimize your GraphQL APIs for clear visibility and control over team modifications, ensuring cohesive and efficient evolution."
            highlights={[
              {
                title: 'Prevent breaking changes',
                description:
                  'Integrated Schema Registry with GraphQL Monitoring for confident API evolution.',
                image: observabilityOverallImage,
              },
              {
                title: 'Detect unused fields',
                description:
                  'Hive detects and removes unused fields in your GraphQL schema for efficiency and tidiness.',
                image: observabilityOverallImage,
              },
              {
                title: 'Schema Policy',
                description:
                  'Hive provides tools to lint, verify, and enforce coding best practices across your federated GraphQL architecture.',
                image: observabilityOverallImage,
              },
            ]}
          />
        </Tabs.Content>
      </Tabs.Root>
    </section>
  );
}

function SchemaRegistryIcon() {
  return (
    <svg width="24" height="24" fill="currentColor">
      <path d="M5.25 7.5a2.25 2.25 0 1 1 3 2.122v4.756a2.251 2.251 0 1 1-1.5 0V9.622A2.25 2.25 0 0 1 5.25 7.5Zm9.22-2.03a.75.75 0 0 1 1.06 0l.97.97.97-.97a.75.75 0 1 1 1.06 1.06l-.97.97.97.97a.75.75 0 0 1-1.06 1.06l-.97-.97-.97.97a.75.75 0 1 1-1.06-1.06l.97-.97-.97-.97a.75.75 0 0 1 0-1.06Zm2.03 5.03a.75.75 0 0 1 .75.75v3.128a2.251 2.251 0 1 1-1.5 0V11.25a.75.75 0 0 1 .75-.75Z" />
    </svg>
  );
}

function GraphQLObservabilityIcon() {
  return (
    <svg width="24" height="24" fill="currentColor">
      <path d="M11.1 19.2v-6.3H9.3v-2.7h5.4v2.7h-1.8v6.3h4.5V21H6.6v-1.8h4.5Zm-.9-16V2.1h3.6v1.1a8.102 8.102 0 0 1 2.694 14.64l-1-1.497a6.3 6.3 0 1 0-6.99 0l-.998 1.497A8.103 8.103 0 0 1 10.2 3.2Z" />
    </svg>
  );
}

function SchemaManagementIcon() {
  return (
    <svg width="24" height="24" fill="currentColor">
      <path d="M7.761 9.111a2.701 2.701 0 0 0 2.606 1.989h3.6a4.5 4.5 0 0 1 4.434 3.731 2.7 2.7 0 1 1-3.489 3.075 2.7 2.7 0 0 1 1.66-3.017 2.702 2.702 0 0 0-2.605-1.989h-3.6a4.48 4.48 0 0 1-2.7-.9v2.853a2.701 2.701 0 1 1-1.8 0V9.147a2.7 2.7 0 1 1 1.894-.036ZM6.767 7.5a.9.9 0 1 0 0-1.8.9.9 0 0 0 0 1.8Zm0 10.8a.9.9 0 1 0 0-1.8.9.9 0 0 0 0 1.8Zm10.8 0a.9.9 0 1 0 0-1.8.9.9 0 0 0 0 1.8Z" />
    </svg>
  );
}

function Feature(props: {
  icon: ReactNode;
  title: string;
  description: string;
  highlights: {
    title: string;
    description: string;
    image: StaticImageData;
  }[];
  documentationLink?: string;
}) {
  const [activeHighlight, setActiveHighlight] = useState(0);
  const { icon, title, description, documentationLink, highlights } = props;

  return (
    <article className="grid grid-cols-1 lg:grid-cols-2">
      <div className="flex flex-col gap-6 px-4 pb-4 md:gap-12 md:pb-12 md:pl-12 md:pr-16">
        <header className="flex flex-col gap-4 md:gap-6">
          <Stud>{icon}</Stud>
          <Heading as="h2" size="md" className="text-green-1000">
            {title}
          </Heading>
          <p className="leading-6 text-green-800">{description}</p>
        </header>
        <dl className="grid grid-cols-2 gap-4 md:gap-12">
          {highlights.map((highlight, i) => {
            return (
              <div key={highlight.title} onPointerOver={() => setActiveHighlight(i)}>
                <dt className="text-green-1000 font-medium">{highlight.title}</dt>
                <dd className="mt-2 text-sm leading-5 text-green-800">{highlight.description}</dd>
              </div>
            );
          })}
        </dl>
        <CallToAction variant="primary" href={documentationLink}>
          Learn more
          <ArrowIcon />
        </CallToAction>
      </div>
      {highlights.map((highlight, i) => (
        <div key={i} className={cn('h-full', activeHighlight === i ? 'block' : 'hidden')}>
          {/* TODO: Chat with the designer about the mobile version of this again. */}
          {/* <div className="relative px-4 sm:px-6 lg:hidden">
              <p className="relative mx-auto max-w-2xl text-base text-black sm:text-center">
                {highlight.description}
              </p>
            </div> */}
          <div className="relative ml-6 h-full min-h-[400px] flex-1 overflow-hidden rounded-3xl bg-blue-400">
            {/* TODO: Use cropped images so we don't load too much without need. */}
            <Image
              width={925}
              height={578}
              src={highlight.image}
              className="absolute left-6 top-[24px] h-[calc(100%-24px)] rounded-tl-3xl object-cover object-left lg:left-[55px] lg:top-[108px] lg:h-[calc(100%-108px)]"
              role="presentation"
              alt=""
            />
          </div>
        </div>
      ))}
    </article>
  );
}

function useSmallScreenTabsHandlers() {
  const isSmallScreen = () => window.innerWidth < 640;
  return {
    onBlur: (event: React.FocusEvent<HTMLDivElement>) => {
      const tabs = event.currentTarget.querySelectorAll('[role="tablist"] > [role="tab"]');
      for (const tab of tabs) {
        tab.ariaSelected = 'false';
      }
    },
    onValueChange: () => {
      if (!isSmallScreen()) return;
      setTimeout(() => {
        const activeElement = document.activeElement;
        // This isn't a perfect dropdown for keyboard users, but we only render it on mobiles.
        if (activeElement && activeElement instanceof HTMLElement && activeElement.role === 'tab') {
          activeElement.blur();
        }
      }, 0);
    },
    // edge case, but people can plug in keyboards to phones
    onKeyDown: (event: React.KeyboardEvent<HTMLDivElement>) => {
      if (
        !isSmallScreen() ||
        (event.key !== 'ArrowDown' && event.key !== 'ArrowUp' && event.key !== 'Enter')
      ) {
        return;
      }
      event.preventDefault();

      // We proceed only if the tablist is focused.
      const activeElement = document.activeElement;
      if (
        !activeElement ||
        !(activeElement instanceof HTMLElement) ||
        activeElement.role !== 'tab'
      ) {
        return;
      }

      const items = activeElement.parentElement?.querySelectorAll('[role="tab"]');
      if (!items) {
        return;
      }

      let index = Array.from(items).indexOf(activeElement);
      for (const [i, item] of items.entries()) {
        if (item.ariaSelected === 'true') {
          index = i;
        }
        item.ariaSelected = 'false';
      }

      switch (event.key) {
        case 'ArrowDown':
          index = (index + 1) % items.length;
          break;

        case 'ArrowUp':
          index = (index - 1 + items.length) % items.length;
          break;

        case 'Enter': {
          const item = items[index];
          if (item instanceof HTMLElement) {
            if (item.dataset.state === 'active') {
              item.blur();
            } else {
              item.focus();
            }
          }
          break;
        }
      }

      items[index].ariaSelected = 'true';
    },
  };
}
