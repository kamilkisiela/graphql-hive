import { ReactElement } from 'react';
import Head from 'next/head';

export const MetaTitle = ({ title }: { title: string }): ReactElement => {
  const pageTitle = `${title} - GraphQL Hive`;

  return (
    <Head>
      <title>{pageTitle}</title>
      <meta property="og:title" content={pageTitle} key="title" />
    </Head>
  );
};
