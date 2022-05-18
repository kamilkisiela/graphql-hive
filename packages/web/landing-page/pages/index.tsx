import React from 'react';
import Head from 'next/head';
import { GlobalStyles } from 'twin.macro';
import { Logo } from '../components/logo';
import { VersionControl } from '../components/illustrations/version-control';
import { OpenSource } from '../components/illustrations/open-source';
import { World } from '../components/illustrations/world';
import { Universal } from '../components/illustrations/universal';
import { Honeycomb } from '../components/honeycomb';
import {
  Header,
  FooterExtended,
  GlobalStyles as TGCStyles,
} from '@theguild/components';

function TopBar() {
  return (
    <div tw="py-6 relative flex-shrink-0">
      <Logo tw="mx-auto" />
    </div>
  );
}

function Hero() {
  return (
    <main tw="w-4/5 lg:w-3/5 mx-auto pt-16 text-center">
      <h1 tw="font-title text-3xl font-extrabold">
        Manage your GraphQL API workflow
      </h1>
      <h2 tw="text-base pt-3 text-gray-500">
        An open-source registry of schemas with many additional features to
        enhance your day-to-day work with GraphQL
      </h2>
    </main>
  );
}

function EarlyAccess() {
  const [email, setEmail] = React.useState('');
  const [disabled, setDisabled] = React.useState(false);
  const [status, setStatus] = React.useState<'success' | 'failure' | null>(
    null
  );
  const onChange = React.useCallback(
    (ev) => {
      setEmail(ev.target.value);
    },
    [setEmail]
  );
  const onSubmit = React.useCallback(
    (ev) => {
      ev.preventDefault();
      setDisabled(true);
      fetch('https://app.graphql-hive.com/api/join-waiting-list', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          email,
        }),
      })
        .then((response) => response.json())
        .then(
          (result) => {
            if (result.ok) {
              setStatus('success');
              setDisabled(false);
            } else {
              setStatus('failure');
              setDisabled(false);
            }
          },
          (error) => {
            console.error(error);
            setStatus('failure');
            setDisabled(false);
          }
        );
    },
    [email, setDisabled, setStatus]
  );

  return (
    <div tw="w-4/5 lg:w-3/5 pt-12 mx-auto">
      <form tw="w-full flex flex-row" onSubmit={onSubmit}>
        <input
          type="email"
          name="email"
          value={email}
          onChange={onChange}
          disabled={disabled}
          placeholder="Your Email"
          tw="
            w-full p-3
            bg-gray-100
            text-black
            border-2 border-transparent
            rounded-bl-md rounded-tl-md
            focus:outline-none
            hover:border-yellow-500
            focus:border-yellow-500
            disabled:cursor-not-allowed
          "
        />
        <input
          type="submit"
          value="Request Early Access"
          disabled={disabled}
          tw="
            p-3
            rounded-br-md rounded-tr-md
            bg-yellow-500 hover:bg-yellow-600
            text-white
            cursor-pointer
            disabled:cursor-not-allowed
          "
        />
      </form>
      {status === 'failure' && (
        <div tw="pt-3 text-center text-red-500">
          Failed to join the waiting list. Try again or{' '}
          <a target="_blank" href="mailto:contact@the-guild.dev">
            contact@the-guild.dev
          </a>
        </div>
      )}
      {status === 'success' && (
        <div tw="pt-3 text-center text-yellow-500">
          Request successful. We'll get back to you soon!
        </div>
      )}
    </div>
  );
}

function Highlight({ title, description, image }) {
  return (
    <div tw="flex flex-col lg:flex-row p-6 w-full bg-white rounded-md items-center shadow">
      <div>
        <h3 tw="font-title font-medium">{title}</h3>
        <p tw="mt-3 text-sm text-gray-500">{description || title}</p>
      </div>
      <div tw="flex-grow lg:ml-6 width[120px] my-6 lg:my-0">{image}</div>
    </div>
  );
}

const CookiesConsent: React.FC = () => {
  const [show, setShow] = React.useState(
    typeof window !== 'undefined' && localStorage.getItem('cookies') === null
  );

  const accept = React.useCallback(() => {
    setShow(false);
    localStorage.setItem('cookies', 'true');
  }, [setShow]);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const close = React.useCallback(() => {
    setShow(false);
    localStorage.setItem('cookies', 'false');
  }, [setShow]);

  if (!show) {
    return null;
  }

  return (
    <div tw="w-full fixed bg-gray-100 px-5 py-7 bottom-0 flex gap-4 flex-wrap lg:flex-nowrap text-center lg:text-left items-center justify-center lg:justify-between">
      <div tw="w-full text-sm">
        <p>
          This website uses cookies to analyze site usage and improve your
          experience.{' '}
        </p>
        <p>
          If you continue to use our services, you are agreeing to the use of
          such cookies.{' '}
        </p>
      </div>
      <div tw="flex gap-4 items-center flex-shrink-0 lg:pr-24">
        <a
          href="/privacy-policy.pdf"
          tw="text-emerald-600 whitespace-nowrap hover:underline"
        >
          Privacy Policy
        </a>
        <button
          tw="bg-emerald-500 px-5 py-2 text-white rounded-md hover:bg-emerald-700 focus:outline-none"
          onClick={accept}
        >
          Allow Cookies
        </button>
      </div>
    </div>
  );
};

function Highlights() {
  return (
    <div tw="flex-grow py-12 bg-gradient-to-b from-yellow-500 via-yellow-600 to-yellow-600">
      <div tw="grid grid-cols-1 md:grid-cols-2 gap-12 w-4/5 lg:width[990px] mx-auto">
        <Highlight
          title="Open-Source"
          description="Community-based project where everyone can shape its future."
          image={<OpenSource />}
        />
        <Highlight
          title="Framework agnostic"
          description="Aims to be compatible with any kind of GraphQL server."
          image={<Universal />}
        />
        <Highlight
          title="Works with any CI/CD"
          description="Integrates with GitHub, Bitbucket and Azure seamlessly."
          image={<VersionControl />}
        />
        <Highlight
          title="Distributed Schemas"
          description="Supports Apollo Federation and Schema Stitching"
          image={<World />}
        />
      </div>
    </div>
  );
}

export default function Index() {
  const title = 'GraphQL Hive - Manage your GraphQL API workflow';
  const description =
    'An open-source registry of schemas with many additional features to enhance your day-to-day work with GraphQL';

  return (
    <>
      <Head>
        <meta charSet="utf-8" />
        <title>{title}</title>
        <meta property="og:title" content={title} key="title" />
        <meta name="description" content={description} key="description" />
        <meta
          name="og:description"
          content={description}
          key="og:description"
        />
        <meta
          property="og:url"
          key="og:url"
          content="https://graphql-hive.com"
        />
        <meta property="og:type" key="og:type" content="website" />
        <meta
          property="og:image"
          key="og:image"
          content="https://the-guild-og-image.vercel.app/**Manage%20your%20GraphQL%20APIs**.png?theme=light&md=1&fontSize=100px&images=https://graphql-hive.com/logo.svg&widths=800&heights=400"
        />
        <meta property="og:type" content="website" />
        <meta property="og:locale" content="en" />
        <meta
          name="twitter:card"
          key="twitter:card"
          content="summary_large_image"
        />
        <meta name="twitter:site" key="twitter:site" content="@TheGuildDev" />
        <link rel="canonical" href="https://graphql-hive.com" />
      </Head>

      <div tw="flex flex-col h-full">
        <style global jsx>{`
          html,
          body,
          #__next {
            height: 100vh;
          }

          body {
            margin: 0;
          }
        `}</style>
        <GlobalStyles />
        <TGCStyles includeFonts />
        <Header activeLink="/open-source" accentColor="#D49605" />
        <TopBar />
        <div tw="flex-shrink-0 relative">
          <div tw="absolute left-0 top-0 right-0 bottom-0 opacity-5">
            <Honeycomb />
          </div>
          <div tw="relative pb-24">
            <div tw="w-full lg:width[990px] mx-auto">
              <Hero />
              <EarlyAccess />
            </div>
          </div>
        </div>
        <Highlights />
        <FooterExtended
          resources={[
            {
              title: 'Privacy Policy',
              href: '/privacy-policy.pdf',
              children: 'Privacy Policy',
            },
            {
              title: 'Terms of Use',
              href: '/terms-of-use.pdf',
              children: 'Terms of Use',
            },
          ]}
        />
      </div>
      <CookiesConsent />
    </>
  );
}
