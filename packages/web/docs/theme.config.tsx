/* eslint sort-keys: error */
import { defineConfig, useTheme, Giscus } from '@theguild/components';
import { useRouter } from 'next/router';

export default defineConfig({
  docsRepositoryBase: 'https://github.com/kamilkisiela/graphql-hive/tree/main/packages/web/docs',
  siteName: 'HIVE',
  main({ children }) {
    const { resolvedTheme } = useTheme()
    const { route } = useRouter()

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
    )
  },
});
