import { useRouter } from 'next/router';
import {
  defineConfig,
  Giscus,
  HiveFooter,
  HiveNavigation,
  PRODUCTS,
  useConfig,
  useTheme,
} from '@theguild/components';
import { ProductUpdateBlogPostHeader } from './src/components/product-update-blog-post-header';
import { cn } from './src/lib';

const HiveLogo = PRODUCTS.HIVE.logo;

export default defineConfig({
  docsRepositoryBase: 'https://github.com/kamilkisiela/graphql-hive/tree/main/packages/web/docs',
  navbar: {
    component: props => {
      const { route } = useRouter();

      console.log('navbar props', props);

      return (
        <HiveNavigation
          // eslint-disable-next-line tailwindcss/no-custom-classname
          className={route === '/' ? 'never-dark' : ''}
          companyMenuChildren={null}
          {...props}
        />
      );
    },
  },
  footer: {
    component: _props => {
      const { route } = useRouter();

      return (
        <HiveFooter
          className={cn(route === '/' && 'never-dark', 'pt-[72px] [&>:first-child]:mx-4')}
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
  description: 'Schema registry for your GraphQL workflows',
  websiteName: 'Hive',
  logo: <HiveLogo className="text-green-1000" />,
});
