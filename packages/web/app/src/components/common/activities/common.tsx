import * as React from 'react';
import tw from 'twin.macro';
import { useColorModeValue } from '@chakra-ui/react';
import NextLink from 'next/link';
import {
  OrganizationActivitiesQuery,
  OrganizationEssentialsFragment,
  ProjectActivitiesQuery,
  ProjectEssentialsFragment,
  TargetActivitiesQuery,
  TargetEssentialsFragment,
  UserFieldsFragment,
} from '@/graphql';

const Link = tw.a`text-yellow-500 dark:text-yellow-300 hover:text-yellow-600 dark:hover:text-yellow-500`;
export const Highlight = tw.span`text-yellow-500 dark:text-yellow-300 hover:text-yellow-600 dark:hover:text-yellow-500`;

export type ActivityNode =
  | OrganizationActivitiesQuery['organizationActivities']['nodes'][0]
  | ProjectActivitiesQuery['projectActivities']['nodes'][0]
  | TargetActivitiesQuery['targetActivities']['nodes'][0];

export const Activity = {
  Root: tw.div`flex relative py-3`,
  Icon: tw.div`flex-shrink-0 w-6 h-6 text-gray-500 inline-flex items-center justify-center relative`,
  Content: tw.div`flex-grow pl-2`,
  Text: tw.p`leading-relaxed text-sm`,
  Time: tw.p`text-gray-600 dark:text-gray-400 text-xs`,
};

export const User: React.FC<{
  user: UserFieldsFragment | string;
}> = ({ user }) => {
  return <span>{typeof user === 'string' ? user : user.displayName}</span>;
};

export const Target: React.FC<{
  name?: string;
  target: TargetEssentialsFragment;
  project: ProjectEssentialsFragment;
  organization: OrganizationEssentialsFragment;
}> = ({ name, target, project, organization }) => {
  return (
    <NextLink passHref href={`/${organization.cleanId}/${project.cleanId}/${target.cleanId}`}>
      <Link>{name ?? target.name}</Link>
    </NextLink>
  );
};

export const Project: React.FC<{
  project: ProjectEssentialsFragment;
  organization: OrganizationEssentialsFragment;
}> = ({ project, organization }) => {
  return (
    <NextLink href={`/${organization.cleanId}/${project.cleanId}`} passHref>
      <Link>{project.name}</Link>
    </NextLink>
  );
};

export const useAddIconColor = () => {
  return useColorModeValue('#76b802', '#a7d950');
};

export const useRemoveIconColor = () => {
  return useColorModeValue('#e03434', '#da5656');
};
