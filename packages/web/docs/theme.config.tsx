/* eslint sort-keys: error */
import { useRouter } from 'next/router';
import { defineConfig, FooterExtended, Giscus, useConfig, useTheme } from '@theguild/components';
import { ChangelogBlogPostHeader } from './src/components/changelog-blog-post-header';

export default defineConfig({
  docsRepositoryBase: 'https://github.com/kamilkisiela/graphql-hive/tree/main/packages/web/docs',
  footer: {
    component: () => (
      <FooterExtended
        resources={[
          {
            children: 'Privacy Policy',
            href: 'https://the-guild.dev/graphql/hive/privacy-policy.pdf',
            title: 'Privacy Policy',
          },
          {
            children: 'Terms of Use',
            href: 'https://the-guild.dev/graphql/hive/terms-of-use.pdf',
            title: 'Terms of Use',
          },
        ]}
      />
    ),
  },
  main({ children }) {
    const { resolvedTheme } = useTheme();
    const { route } = useRouter();
    const config = useConfig();

    if (route.startsWith('/changelog')) {
      children = (
        <>
          <ChangelogBlogPostHeader meta={config.frontMatter as any} />
          {children}
        </>
      );
    }

    return (
      <>
        {children}
        <Giscus
          // ensure giscus is reloaded when client side route is changed
          key={route}
          repo="kamilkisiela/graphql-hive"
          repoId="R_kgDOHWr5kA"
          category="Docs Discussions"
          categoryId="DIC_kwDOHWr5kM4CSDSS"
          mapping="pathname"
          theme={resolvedTheme}
        />
      </>
    );
  },
  siteName: 'HIVE',
});
