import React from 'react';
import 'twin.macro';
import * as RadixTooltip from '@radix-ui/react-tooltip';

function Tooltip(
  props: React.PropsWithChildren<{
    content: string;
  }>
) {
  return (
    <RadixTooltip.Root>
      <RadixTooltip.Trigger>{props.children}</RadixTooltip.Trigger>
      <RadixTooltip.Content sideOffset={5} tw="p-2 text-xs rounded-sm bg-white shadow">
        {props.content}
        <RadixTooltip.Arrow tw="fill-current text-white" />
      </RadixTooltip.Content>
    </RadixTooltip.Root>
  );
}

function Plan(plan: {
  name: string;
  description: string;
  price: React.ReactNode | string;
  features: Array<React.ReactNode | string>;
  footer?: React.ReactNode;
}) {
  return (
    <div tw="flex w-full md:w-1/3 flex-col items-start rounded-md border border-gray-700 p-4 hover:border-gray-600">
      <div tw="flex h-full flex-col justify-between">
        <div>
          <h2 tw="text-base text-white font-bold flex items-center justify-between">{plan.name}</h2>
          <div tw="text-3xl font-bold text-white">{plan.price}</div>
          <div tw="text-sm text-gray-500 mt-3">{plan.description}</div>
          <div>
            <ul tw="mt-6 list-disc px-5 text-gray-500">
              {plan.features.map((feature, i) => {
                return (
                  <li key={i} tw="box-border mb-2">
                    <div tw="text-sm text-gray-300 flex items-center">{feature}</div>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
        {plan.footer && (
          <div>
            <div tw="mx-auto my-4 w-9/12 border-b border-gray-800" />
            <div tw="text-xs text-gray-300">{plan.footer}</div>
          </div>
        )}
      </div>
    </div>
  );
}

const usageDataRetentionExplainer = 'How long to store GraphQL requests reported to GraphQL Hive';
const operationsExplainer = 'GraphQL requests reported to GraphQL Hive';

export function Pricing({ gradient }: { gradient: [string, string] }) {
  return (
    <div style={{ backgroundColor: 'rgb(23, 23, 23)' }} tw="w-full">
      <div tw="max-width[1024px] w-full px-6 box-border mx-auto my-12">
        <h2
          tw="md:text-3xl text-2xl text-white font-bold bg-clip-text text-transparent dark:text-transparent leading-normal"
          style={{
            backgroundImage: `linear-gradient(-70deg, ${gradient[1]}, ${gradient[0]})`,
          }}
        >
          Pricing
        </h2>
        <p tw="text-gray-400">All features are available in every plan</p>
        <div tw="flex flex-col md:flex-row content-start items-stretch justify-start justify-items-start gap-4 mt-6">
          <Plan
            name="Hobby"
            description="For personal or small projects"
            price="Free"
            features={[
              'Unlimited seats',
              'Unlimited schema pushes',
              <Tooltip content={operationsExplainer}>Limit of 1M operations monthly</Tooltip>,
              <Tooltip content={usageDataRetentionExplainer}>7 days of usage data retention</Tooltip>,
            ]}
          />
          <Plan
            name="Pro"
            description="For scaling API"
            price={
              <Tooltip content="Base price charged monthly">
                $10<span tw="text-sm text-gray-500">/mo</span>
              </Tooltip>
            }
            features={[
              'Unlimited seats',
              'Unlimited schema pushes',
              <Tooltip content={operationsExplainer}>$10 per 1M operations monthly</Tooltip>,
              <Tooltip content={usageDataRetentionExplainer}>90 days of usage data retention</Tooltip>,
            ]}
            footer={
              <>
                <div tw="mb-2 text-sm font-bold">Free 30 days trial period</div>
              </>
            }
          />
          <Plan
            name="Enterprise"
            description="Custom plan for large companies"
            price={
              <span
                tw="cursor-pointer"
                onClick={() => {
                  if (typeof window !== 'undefined' && (window as any).$crisp) {
                    (window as any).$crisp.push(['do', 'chat:open']);
                  }
                }}
              >
                Contact us
              </span>
            }
            features={[
              'Unlimited seats',
              'Unlimited schema pushes',
              <Tooltip content={operationsExplainer}>Unlimited operations</Tooltip>,
              <Tooltip content={usageDataRetentionExplainer}>12 months of usage data retention</Tooltip>,
              <span tw="flex gap-1">
                Support from
                <a
                  href="https://the-guild.dev"
                  target="_blank"
                  rel="noreferrer"
                  tw="font-medium transition-colors text-orange-500 hover:underline"
                >
                  The Guild
                </a>
              </span>,
            ]}
            footer={<>Shape a custom plan for your business</>}
          />
        </div>
      </div>
    </div>
  );
}
