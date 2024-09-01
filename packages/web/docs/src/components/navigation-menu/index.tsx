import { ComponentPropsWithoutRef } from 'react';
import { useRouter } from 'next/router';
import { GraphQLConfCard, HiveNavigation, type Navbar } from '@theguild/components';
import graphQLConfLocalImage from './graphql-conf-image.webp';

export function NavigationMenu(props: ComponentPropsWithoutRef<typeof Navbar>) {
  const { route } = useRouter();

  return (
    <HiveNavigation
      className={route === '/' ? 'never-dark max-w-[75rem]' : 'max-w-[90rem]'}
      companyMenuChildren={<GraphQLConfCard image={graphQLConfLocalImage} />}
      {...props}
    />
  );
}
