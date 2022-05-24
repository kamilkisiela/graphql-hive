import * as React from 'react';
import 'twin.macro';
import Link from 'next/link';
import { CriticalityLevel, OrganizationFieldsFragment, ProjectFieldsFragment, TargetFieldsFragment } from '@/graphql';
import { Card, Circle, Label } from '@/components/common';

export const ProjectCard: React.FC<{
  org: OrganizationFieldsFragment;
  project: ProjectFieldsFragment;
  targets: TargetFieldsFragment[];
}> = ({ org, project, targets }) => {
  return (
    <Card.Root>
      <Link href={`/${org.cleanId}/${project.cleanId}`}>
        <Card.Title tw="flex items-center justify-between cursor-pointer">
          {project.name} <Label>{project.type}</Label>
        </Card.Title>
      </Link>
      <Card.Content>
        {targets.map(target => (
          <Card.List key={target.id}>
            <div tw="flex items-center">
              <Circle criticality={CriticalityLevel.Safe} tw="mr-2" />
              <Link href={`/${org.cleanId}/${project.cleanId}/${target.cleanId}`}>{target.name}</Link>
            </div>
          </Card.List>
        ))}
      </Card.Content>
    </Card.Root>
  );
};
