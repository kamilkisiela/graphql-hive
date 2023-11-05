import { Injectable, Scope } from 'graphql-modules';
import { cache, filterSelector } from '../../../shared/helpers';
import { Logger } from './logger';
import type { OrganizationSelector, ProjectSelector, TargetSelector } from './storage';
import { Storage } from './storage';

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

  @cache<OrganizationSelector>(selector => selector.organization)
  translateOrganizationId(selector: OrganizationSelector) {
    this.logger.debug(
      'Translating Organization Clean ID (selector=%o)',
      filterSelector('organization', selector),
    );
    return this.storage.getOrganizationId(selector);
  }

  @cache<ProjectSelector>(selector => [selector.organization, selector.project].join(','))
  translateProjectId(selector: ProjectSelector) {
    this.logger.debug(
      'Translating Project Clean ID (selector=%o)',
      filterSelector('project', selector),
    );
    return this.storage.getProjectId(selector);
  }

  @cache<
    TargetSelector & {
      useIds?: boolean;
    }
  >(selector =>
    [selector.organization, selector.project, selector.target, selector.useIds].join(','),
  )
  translateTargetId(
    selector: TargetSelector & {
      useIds?: boolean;
    },
  ) {
    this.logger.debug(
      'Translating Target Clean ID (selector=%o)',
      filterSelector('target', selector),
    );
    return this.storage.getTargetId(selector);
  }
}
