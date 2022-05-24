import React from 'react';
import 'twin.macro';

function Plan(plan: {
  name: string;
  description: string;
  price: number | string;
  features: Array<React.ReactNode | string>;
  footer?: React.ReactNode;
}) {
  return (
    <div tw="flex w-1/3 flex-col items-start rounded-md border border-gray-700 p-4 hover:border-gray-600">
      <div tw="flex h-full flex-col justify-between">
        <div>
          <h2 tw="text-base text-black dark:text-white font-bold flex items-center justify-between">{plan.name}</h2>
          <div tw="text-3xl font-bold text-white">
            {typeof plan.price === 'string' ? (
              plan.price
            ) : (
              <>
                {'$'}
                {plan.price}
                <span tw="text-sm text-gray-500">/mo</span>
              </>
            )}
          </div>
          <div tw="text-sm text-gray-500">{plan.description}</div>
          <div>
            <ul tw="mt-6 list-disc px-5 text-gray-500">
              {plan.features.map((feature, i) => {
                return (
                  <li key={i} tw="box-border mb-2">
                    <div tw="text-sm text-gray-600 dark:text-gray-300 flex items-center">{feature}</div>
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

export function Pricing() {
  return (
    <div style={{ backgroundColor: 'rgb(23, 23, 23)' }} tw="w-full">
      <div tw="max-width[1024px] w-full px-6 box-border mx-auto my-12">
        <h2 tw="md:text-3xl text-2xl text-white font-bold">Pricing</h2>
        <p tw="text-gray-400">Available in the application</p>
        <div tw="flex flex-row content-start	items-stretch justify-start justify-items-start gap-4 mt-6">
          <Plan
            name="Hobby"
            description="For personal or small projects"
            price="Free"
            features={[
              'Unlimited seats',
              '1M operations',
              '50 schema pushes',
              'Schema Registry',
              'Detection of breaking changes based on usage reports',
              'GitHub and Slack integrations',
              '3 days of usage data retention',
            ]}
          />
          <Plan
            name="Pro"
            description="For growing teams"
            price={50}
            features={[
              'Unlimited seats',
              '5M operations',
              '500 schema pushes',
              'Schema Registry',
              'Detection of breaking changes based on usage reports',
              'GitHub and Slack integrations',
              '180 days of usage data retention',
              <div>
                Schema Policy Checks <span tw="text-xs">(coming soon)</span>
              </div>,
              <div>
                ESLint integration <span tw="text-xs">(coming soon)</span>
              </div>,
            ]}
            footer={
              <>
                <div tw="mb-2 text-sm font-bold">Free 14-day trial period</div>
                <div>$15 for additional 1M operations</div>
                <div>$1 for additional 10 schema pushes</div>
              </>
            }
          />
          <Plan
            name="Enterprise"
            description="Custom plan for large companies"
            price="Contact us"
            features={[
              'Unlimited seats',
              'Unlimited operations',
              'Unlimited schema pushes',
              'Schema Registry',
              'Detection of breaking changes based on usage reports',
              'GitHub and Slack integrations',
              '360 days of usage data retention',
              <div>
                Schema Policy Checks <span tw="text-xs">(coming soon)</span>
              </div>,
              <div>
                ESLint integration <span tw="text-xs">(coming soon)</span>
              </div>,
              'SAML (coming soon)',
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
