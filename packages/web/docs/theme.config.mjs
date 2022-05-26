import { VscTerminal } from 'react-icons/vsc';
const projectLink = process.env.NEXT_PUBLIC_APP_LINK;

export default {
  titleSuffix: ' – Documentation - GraphQL Hive',
  projectLink: projectLink,
  projectLinkIcon: <VscTerminal />,
  github: null,
  docsRepositoryBase: null,
  nextLinks: true,
  prevLinks: true,
  search: true,
  unstable_flexsearch: true,
  floatTOC: true,
  customSearch: null,
  darkMode: true,
  footer: false,
  logo: (
    <>
      <strong>GraphQL Hive</strong>
      <span
        style={{
          marginLeft: '1rem',
        }}
      >
        Documentation
      </span>
    </>
  ),
  head: (
    <>
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <meta name="description" content="GraphQL Hive: documentation" />
      <meta name="og:title" content="GraphQL Hive: documentation" />
    </>
  ),
};
