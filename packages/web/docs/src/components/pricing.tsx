import { ReactElement, ReactNode } from 'react';
import { Arrow, Content, Root, Trigger } from '@radix-ui/react-tooltip';
import { CallToAction, Heading } from '@theguild/components';

function Tooltip({ content, children }: { content: string; children: ReactNode }) {
  return (
    <Root delayDuration={0}>
      <Trigger className="hive-focus -mx-1 -my-0.5 rounded px-1 py-0.5 text-left">
        {children}
      </Trigger>
      <Content
        sideOffset={5}
        className="bg-green-1000 z-20 rounded p-2 text-sm font-normal leading-4 text-white shadow"
      >
        {content}
        <Arrow className="fill-green-1000" />
      </Content>
    </Root>
  );
}

const PlanFeaturesSeparator = Symbol('PlanFeaturesSeparator');
type PlanFeaturesSeparator = typeof PlanFeaturesSeparator;

function Plan(props: {
  name: string;
  description: string;
  price: ReactNode | string;
  features: (ReactNode | string | PlanFeaturesSeparator)[];
  linkText: string;
  linkOnClick?: () => void;
  adjustable: boolean;
}): ReactElement {
  return (
    <article className="w-1/3">
      <header className="text-green-800">
        <div className="flex flex-row items-center gap-2">
          <h2 className="text-2xl font-medium">{props.name}</h2>
          {props.adjustable && (
            <span className="whitespace-nowrap rounded-full bg-green-200 px-3 py-1 text-sm font-medium leading-5">
              Adjust your plan at any time
            </span>
          )}
        </div>
        <p className="mt-2">{props.description}</p>
      </header>
      <div className="mt-8 text-5xl leading-[56px] tracking-[-0.48px]">{props.price}</div>
      <div className="pt-6">
        <CallToAction
          variant="primary"
          {...(props.linkOnClick
            ? {
                href: '#',
                onClick: event => {
                  event.preventDefault();
                  props.linkOnClick?.();
                },
              }
            : { href: 'https://app.graphql-hive.com' })}
        >
          {props.linkText}
        </CallToAction>
      </div>
      <ul className="mt-8 text-green-800">
        {props.features.map((feature, i) =>
          feature === PlanFeaturesSeparator ? (
            <li key={i} className="py-2 font-medium">
              Plus:
            </li>
          ) : (
            <li key={i} className="border-green-200 py-2 [&+&]:border-t">
              {feature}
            </li>
          ),
        )}
      </ul>
    </article>
  );
}

const USAGE_DATA_RETENTION_EXPLAINER = 'How long your GraphQL operations are stored on Hive';
const OPERATIONS_EXPLAINER = 'GraphQL operations reported to GraphQL Hive';

export function Pricing(): ReactElement {
  return (
    <section className="py-12 sm:py-24">
      <div className="mx-auto box-border w-full max-w-[1200px]">
        <header className="px-6">
          <Heading as="h2" size="md" className="text-green-1000 text-center">
            Pricing
          </Heading>
          <p className="mx-auto mt-4 max-w-xl text-balance text-center text-green-800 lg:text-wrap">
            All features are available on all plans — including the free&nbsp;plan. Our pricing is
            honest and based only on your real usage.
          </p>
        </header>

        <div
          // the padding is here so `overflow-auto` doesn't cut button hover states
          className="-mx-2 overflow-auto px-2"
        >
          <div className="mt-16 flex min-w-[1000px] flex-row items-stretch gap-8 px-6 lg:mt-24 lg:gap-10 xl:gap-12 xl:px-0">
            <Plan
              name="Hobby"
              description="For personal or small projects"
              adjustable={false}
              price="Free forever"
              linkText="Start for free"
              features={[
                'Unlimited seats, projects and organizations',
                'Unlimited schema pushes & checks',
                <>Full access to all features (including&nbsp;SSO)</>,
                <Tooltip key="t1" content={OPERATIONS_EXPLAINER}>
                  1M operations per month
                </Tooltip>,
                <Tooltip key="t2" content={USAGE_DATA_RETENTION_EXPLAINER}>
                  7 days of usage data retention
                </Tooltip>,
              ]}
            />
            <Plan
              name="Pro"
              description="For scaling API and teams"
              adjustable
              price={
                <Tooltip content="Base price charged monthly">
                  $10<span className="text-base leading-normal text-green-800"> / month</span>
                </Tooltip>
              }
              linkText="🎉 Try free for 30 days"
              features={[
                'Unlimited seats, projects and organizations',
                'Unlimited schema pushes & checks',
                <>Full access to all features (including&nbsp;SSO)</>,
                <Tooltip key="t1" content={OPERATIONS_EXPLAINER}>
                  1M operations per month
                </Tooltip>,
                <Tooltip key="t2" content={USAGE_DATA_RETENTION_EXPLAINER}>
                  90 days of usage data retention
                </Tooltip>,
                PlanFeaturesSeparator,
                <Tooltip key="t1" content={OPERATIONS_EXPLAINER}>
                  $10 per additional 1M operations
                </Tooltip>,
              ]}
            />
            <Plan
              name="Enterprise"
              description="Custom plan for large companies"
              adjustable
              price={
                <span
                  className="cursor-pointer"
                  onClick={() => {
                    (window as any).$crisp?.push(['do', 'chat:open']);
                  }}
                >
                  Contact us
                </span>
              }
              linkText="Contact us for a custom plan"
              linkOnClick={() => {
                (window as any).$crisp?.push(['do', 'chat:open']);
              }}
              features={[
                'Unlimited seats, projects and organizations',
                'Unlimited schema pushes & checks',
                <>Full access to all features (including&nbsp;SSO)</>,
                <Tooltip key="t1" content={OPERATIONS_EXPLAINER}>
                  Custom limit of operations
                </Tooltip>,
                <Tooltip key="t2" content={USAGE_DATA_RETENTION_EXPLAINER}>
                  12 months of usage data retention
                </Tooltip>,
                PlanFeaturesSeparator,
                'Improved pricing as you scale',
                <span>
                  GraphQL / APIs support and guidance from{' '}
                  <a
                    href="https://the-guild.dev"
                    target="_blank"
                    rel="noreferrer"
                    className="hive-focus -mx-1 -my-0.5 rounded px-1 py-0.5 underline hover:text-blue-700"
                  >
                    The&nbsp;Guild
                  </a>
                </span>,
              ]}
            />
          </div>
        </div>
      </div>
    </section>
  );
}
