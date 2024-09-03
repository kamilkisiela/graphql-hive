import { ComponentPropsWithoutRef } from 'react';
import { useRouter } from 'next/router';
import { GraphQLConfCard, HiveNavigation, PRODUCTS, type Navbar } from '@theguild/components';
import graphQLConfLocalImage from './graphql-conf-image.webp';

export function NavigationMenu(props: ComponentPropsWithoutRef<typeof Navbar>) {
  const { route } = useRouter();

  return (
    <HiveNavigation
      className={route === '/' ? 'light max-w-[1392px]' : 'max-w-[90rem]'}
      companyMenuChildren={<GraphQLConfCard image={graphQLConfLocalImage} />}
      productName={PRODUCTS.HIVE.name}
      {...props}
    />
  );
}
