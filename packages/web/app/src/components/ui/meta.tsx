import { Helmet } from 'react-helmet';

const defaultDescription =
  'GraphQL Hive is Open GraphQL Platform to help you prevent breaking changes, monitor performance of your GraphQL API, and manage your API gateway (Federation, Stitching) with the Schema Registry. GraphQL Hive is 100% open source and can be self-hosted.';
const defaultSuffix = 'GraphQL Hive';

export function Meta({
  title,
  description = defaultDescription,
  suffix = defaultSuffix,
}: {
  title: string;
  description?: string;
  suffix?: string;
}) {
  const fullTitle = suffix ? `${title} | ${suffix}` : title;

  return (
    <Helmet>
      <title>{fullTitle}</title>
      <meta property="og:title" content={fullTitle} key="title" />
      <meta name="description" content={description} key="description" />
      <meta property="og:url" key="og:url" content="https://app.graphql-hive.com" />
      <meta property="og:type" key="og:type" content="website" />
      <meta
        property="og:image"
        key="og:image"
        content="https://og-image.the-guild.dev/?product=HIVE&title=Open%20GraphQL%20Platform&extra=Prevent breaking changes, monitor performance and manage your gateway (Federation, Stitching)"
      />
    </Helmet>
  );
}
