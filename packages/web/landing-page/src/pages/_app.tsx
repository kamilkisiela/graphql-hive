import { ReactElement } from 'react';
import { AppProps } from 'next/app';
import Head from 'next/head';
import { FooterExtended, Header } from '@theguild/components';
import { ThemeProvider } from 'next-themes';
import '@theguild/components/style.css';

const TITLE = 'GraphQL Hive - Schema Registry and Monitoring';
const DESCRIPTION =
  'Prevent breaking changes, monitor performance of your GraphQL API, and manage your API gateway (Federation, Stitching) with the Schema Registry. GraphQL Hive is a SAAS solution that is also 100% open source and can be self-hosted.';

export default function App({ Component, pageProps }: AppProps): ReactElement {
  return (
    <ThemeProvider attribute="class" disableTransitionOnChange>
      <Head>
        <meta charSet="utf-8" />
        <title>{TITLE}</title>
        <meta property="og:title" content={TITLE} key="title" />
        <meta name="description" content={DESCRIPTION} key="description" />
        <meta name="og:description" content={DESCRIPTION} key="og:description" />
        <meta property="og:type" key="og:type" content="website" />
        <meta
          property="og:image"
          key="og:image"
          content="https://og-image-guild.vercel.app/**Manage%20your%20GraphQL%20APIs**.png?theme=light&md=1&fontSize=100px&images=https://graphql-hive.com/logo.svg&widths=800&heights=400"
        />
        <meta property="og:type" content="website" />
        <meta property="og:locale" content="en" />
        <meta name="twitter:card" key="twitter:card" content="summary_large_image" />
        <meta name="twitter:site" key="twitter:site" content="@TheGuildDev" />
      </Head>

      <Header accentColor="#d49605" search={false} />

      <Component {...pageProps} />

      <FooterExtended
        resources={[
          { title: 'Privacy Policy', href: '/privacy-policy.pdf', children: 'Privacy Policy' },
          { title: 'Terms of Use', href: '/terms-of-use.pdf', children: 'Terms of Use' },
        ]}
      />
    </ThemeProvider>
  );
}
