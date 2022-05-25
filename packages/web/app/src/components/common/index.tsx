import React from 'react';
import tw, { styled } from 'twin.macro';
import Head from 'next/head';
import { TimeAgo as ReactTimeAgo } from '@n1ru4l/react-time-ago';

export const Title: React.FC<{ title: string }> = ({ title }) => (
  <Head>
    <title>{title} - GraphQL Hive</title>
    <meta property="og:title" content={`${title} - GraphQL Hive`} key="title" />
  </Head>
);

export const Label = tw.span`
  inline-block
  py-1 px-2
  rounded
  bg-yellow-50 dark:bg-white dark:bg-opacity-10
  text-yellow-600 dark:text-yellow-300
  text-xs font-medium tracking-widest`;

const PageContent = styled.div(({ scrollable }: { scrollable: boolean }) => [
  tw`px-4 pb-4 dark:text-white`,
  scrollable ? tw`flex-grow overflow-y-auto` : tw`h-full`,
]);

export const Page: React.FC<{
  title: string;
  subtitle?: string;
  actions?: React.ReactElement;
  scrollable?: boolean;
  noPadding?: boolean;
}> = ({ title, subtitle = '', scrollable = false, actions, children, noPadding }) => {
  return (
    <div tw="flex flex-col relative h-full dark:bg-gray-900">
      <div tw="p-4 flex-shrink-0 flex flex-row justify-between items-center">
        <div>
          <h2 tw="text-xl text-black dark:text-white font-bold">{title}</h2>
          <span tw="text-sm text-gray-600 dark:text-gray-300 mt-2">{subtitle}</span>
        </div>
        <div tw="flex flex-row items-center space-x-2">{actions}</div>
      </div>
      {noPadding ? children : <PageContent scrollable={scrollable}>{children}</PageContent>}
    </div>
  );
};

export const Section = {
  Title: tw.h3`text-base text-black dark:text-white font-bold`,
  BigTitle: tw.h2`text-base text-black dark:text-white font-bold`,
  Subtitle: tw.div`text-sm text-gray-600 dark:text-gray-300`,
};

export const TimeAgo: React.FC<{ date: string }> = ({ date }) => {
  const dateObject = React.useMemo(() => new Date(date), [date]);
  return <ReactTimeAgo date={dateObject}>{({ value }) => value}</ReactTimeAgo>;
};

const ScalePiece = styled.div(({ filled }: { filled: boolean }) => [
  tw`w-1 h-4`,
  filled ? tw`bg-emerald-400` : tw`bg-gray-200`,
]);

export const Scale: React.FC<{
  value: number;
  max: number;
  size: number;
  className?: string;
}> = ({ value, max, size, className }) => {
  return (
    <div tw="flex flex-row space-x-1 flex-grow-0" className={className}>
      {new Array(size).fill(null).map((_, i) => (
        <ScalePiece key={i} filled={value >= i * (max / size)} />
      ))}
    </div>
  );
};

export const Description = tw.p`pr-5 text-sm leading-5 text-gray-500 dark:text-gray-300`;
