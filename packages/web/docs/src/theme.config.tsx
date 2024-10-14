import { useRouter } from 'next/router';
import {
  defineConfig,
  Giscus,
  HiveFooter,
  PRODUCTS,
  useConfig,
  useTheme,
} from '@theguild/components';
import { NavigationMenu } from './components/navigation-menu';
import { ProductUpdateBlogPostHeader } from './components/product-update-blog-post-header';
import { cn } from './lib';

const HiveLogo = PRODUCTS.HIVE.logo;

export default defineConfig({
  docsRepositoryBase: 'https://github.com/graphql-hive/platform/tree/main/packages/web/docs',
  color: {
    hue: {
      dark: 67.1,
      light: 173,
    },
    saturation: {
      dark: 100,
      light: 40,
    },
  },
  navbar: { component: NavigationMenu },
  footer: {
    component: _props => {
      const { route } = useRouter();

      return (
        <HiveFooter
          className={cn(
            route === '/' ? 'light' : '[&>:first-child]:mx-0 [&>:first-child]:max-w-[90rem]',
            'pt-[72px]',
          )}
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
      );
    },
  },

  main({ children }) {
    const { resolvedTheme } = useTheme();
    const { route } = useRouter();
    const config = useConfig();

    if (route === '/product-updates') {
      return <>{children}</>;
    }

    if (route.startsWith('/product-updates')) {
      children = (
        <>
          <ProductUpdateBlogPostHeader meta={config.frontMatter as any} />
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
          repo="graphql-hive/platform"
          repoId="R_kgDOHWr5kA"
          category="Docs Discussions"
          categoryId="DIC_kwDOHWr5kM4CSDSS"
          mapping="pathname"
          theme={resolvedTheme}
        />
      </>
    );
  },
  description: 'Schema registry for your GraphQL workflows',
  websiteName: 'Hive',
  logo: <HiveLogo className="text-green-1000" />,
});
