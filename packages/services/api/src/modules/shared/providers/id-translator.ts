import { Injectable, Scope } from 'graphql-modules';
import { cache } from '../../../shared/helpers';
import { Logger } from './logger';
import { Storage } from './storage';

interface OrganizationSelectorInput {
  organizationSlug: string;
}

interface ProjectSelectorInput extends OrganizationSelectorInput {
  projectSlug: string;
}

interface TargetSelectorInput extends ProjectSelectorInput {
  targetSlug: string;
}

@Injectable({
  scope: Scope.Operation,
})
export class IdTranslator {
  private logger: Logger;
  constructor(
    private storage: Storage,
    logger: Logger,
  ) {
    this.logger = logger.child({ service: 'IdTranslator' });
  }

  @cache<OrganizationSelectorInput>(selector => selector.organizationSlug)
  async translateOrganizationId(selector: OrganizationSelectorInput) {
    this.logger.debug(
      'Translating Organization Clean ID (selector=%o)',
      filterSelector('organization', selector),
    );
    const organizationId = await this.storage.getOrganizationId({
      organization: selector.organizationSlug,
    });

    if (!organizationId) {
      throw new Error('Organization not found');
    }

    return organizationId;
  }

  @cache<OrganizationSelectorInput>(selector => selector.organizationSlug)
  translateOrganizationIdSafe(selector: OrganizationSelectorInput) {
    this.logger.debug(
      'Translating Organization Clean ID (selector=%o)',
      filterSelector('organization', selector),
    );
    return this.storage.getOrganizationId({
      organization: selector.organizationSlug,
    });
  }

  @cache<ProjectSelectorInput>(selector =>
    [selector.organizationSlug, selector.projectSlug].join(','),
  )
  translateProjectId(selector: ProjectSelectorInput) {
    this.logger.debug(
      'Translating Project Clean ID (selector=%o)',
      filterSelector('project', selector),
    );
    return this.storage.getProjectId({
      organization: selector.organizationSlug,
      project: selector.projectSlug,
    });
  }

  @cache<
    TargetSelectorInput & {
      useIds?: boolean;
    }
  >(selector =>
    [selector.organizationSlug, selector.projectSlug, selector.targetSlug, selector.useIds].join(
      ',',
    ),
  )
  translateTargetId(
    selector: TargetSelectorInput & {
      useIds?: boolean;
    },
  ) {
    this.logger.debug(
      'Translating Target Clean ID (selector=%o)',
      filterSelector('target', selector),
    );
    return this.storage.getTargetId({
      organization: selector.organizationSlug,
      project: selector.projectSlug,
      target: selector.targetSlug,
      useIds: selector.useIds,
    });
  }
}

function filterSelector(
  kind: 'organization',
  selector: OrganizationSelectorInput,
): OrganizationSelectorInput;
function filterSelector(kind: 'project', selector: ProjectSelectorInput): ProjectSelectorInput;
function filterSelector(kind: 'target', selector: TargetSelectorInput): TargetSelectorInput;
function filterSelector(kind: 'organization' | 'project' | 'target', selector: any): any {
  switch (kind) {
    case 'organization':
      return {
        organizationSlug: selector.organizationSlug,
      };
    case 'project':
      return {
        organizationSlug: selector.organizationSlug,
        projectSlug: selector.projectSlug,
      };
    case 'target':
      return {
        organizationSlug: selector.organizationSlug,
        projectSlug: selector.projectSlug,
        targetSlug: selector.targetSlug,
      };
  }
}
