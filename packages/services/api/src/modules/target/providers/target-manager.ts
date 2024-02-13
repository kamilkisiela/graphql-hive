import { Injectable, Scope } from 'graphql-modules';
import { paramCase } from 'param-case';
import * as zod from 'zod';
import type { Target, TargetSettings } from '../../../shared/entities';
import { share, uuid } from '../../../shared/helpers';
import { ActivityManager } from '../../activity/providers/activity-manager';
import { AuthManager } from '../../auth/providers/auth-manager';
import { ProjectAccessScope } from '../../auth/providers/project-access';
import { TargetAccessScope } from '../../auth/providers/target-access';
import { IdTranslator } from '../../shared/providers/id-translator';
import { Logger } from '../../shared/providers/logger';
import { ProjectSelector, Storage, TargetSelector } from '../../shared/providers/storage';
import { TokenStorage } from '../../token/providers/token-storage';
import { HiveError } from './../../../shared/errors';

/**
 * Responsible for auth checks.
 * Talks to Storage.
 */
@Injectable({
  scope: Scope.Operation,
  global: true,
})
export class TargetManager {
  private logger: Logger;

  constructor(
    logger: Logger,
    private storage: Storage,
    private tokenStorage: TokenStorage,
    private authManager: AuthManager,
    private activityManager: ActivityManager,
    private idTranslator: IdTranslator,
  ) {
    this.logger = logger.child({ source: 'TargetManager' });
  }

  async createTarget({
    name,
    project,
    organization,
  }: {
    name: string;
  } & ProjectSelector): Promise<Target> {
    this.logger.info(
      'Creating a target (name=%s, project=%s, organization=%s)',
      name,
      project,
      organization,
    );
    await this.authManager.ensureProjectAccess({
      project,
      organization,
      scope: ProjectAccessScope.READ,
    });

    let cleanId = paramCase(name);

    if (
      // packages/web/app uses the "view" prefix, let's avoid the collision
      name.toLowerCase() === 'view' ||
      (await this.storage.getTargetByCleanId({ cleanId, project, organization }))
    ) {
      cleanId = paramCase(`${name}-${uuid(4)}`);
    }

    // create target
    const target = await this.storage.createTarget({
      name,
      cleanId,
      project,
      organization,
    });

    await this.activityManager.create({
      type: 'TARGET_CREATED',
      selector: {
        organization,
        project,
        target: target.id,
      },
    });

    return target;
  }

  async deleteTarget({ organization, project, target }: TargetSelector): Promise<Target> {
    this.logger.info(
      'Deleting a target (target=%s, project=%s, organization=%s)',
      target,
      project,
      organization,
    );
    await this.authManager.ensureTargetAccess({
      project,
      organization,
      target,
      scope: TargetAccessScope.DELETE,
    });

    const deletedTarget = await this.storage.deleteTarget({
      target,
      project,
      organization,
    });
    await this.tokenStorage.invalidateTokens(deletedTarget.tokens);

    await this.activityManager.create({
      type: 'TARGET_DELETED',
      selector: {
        organization,
        project,
      },
      meta: {
        name: deletedTarget.name,
        cleanId: deletedTarget.cleanId,
      },
    });

    return deletedTarget;
  }

  async getTargets(selector: ProjectSelector): Promise<readonly Target[]> {
    this.logger.debug('Fetching targets (selector=%o)', selector);
    await this.authManager.ensureProjectAccess({
      ...selector,
      scope: ProjectAccessScope.READ,
    });
    return this.storage.getTargets(selector);
  }

  async getTarget(selector: TargetSelector, scope = TargetAccessScope.READ): Promise<Target> {
    this.logger.debug('Fetching target (selector=%o)', selector);
    await this.authManager.ensureTargetAccess({
      ...selector,
      scope,
    });
    return this.storage.getTarget(selector);
  }

  getTargetIdByToken: () => Promise<string | never> = share(async () => {
    const token = this.authManager.ensureApiToken();
    const { target } = await this.tokenStorage.getToken({ token });

    return target;
  });

  getTargetFromToken: () => Promise<Target | never> = share(async () => {
    const token = this.authManager.ensureApiToken();
    const { target, project, organization } = await this.tokenStorage.getToken({
      token,
    });

    await this.authManager.ensureTargetAccess({
      organization,
      project,
      target,
      scope: TargetAccessScope.READ,
    });

    return this.storage.getTarget({
      organization,
      project,
      target,
    });
  });

  async getTargetSettings(selector: TargetSelector): Promise<TargetSettings> {
    this.logger.debug('Fetching target settings (selector=%o)', selector);
    await this.authManager.ensureTargetAccess({
      ...selector,
      scope: TargetAccessScope.SETTINGS,
    });

    return this.storage.getTargetSettings(selector);
  }

  async setTargetValidation(
    input: {
      enabled: boolean;
    } & TargetSelector,
  ): Promise<TargetSettings['validation']> {
    this.logger.debug('Setting target validation (input=%o)', input);
    await this.authManager.ensureTargetAccess({
      ...input,
      scope: TargetAccessScope.SETTINGS,
    });

    await this.storage.completeGetStartedStep({
      organization: input.organization,
      step: 'enablingUsageBasedBreakingChanges',
    });

    return this.storage.setTargetValidation(input);
  }

  async updateTargetValidationSettings(
    input: Omit<TargetSettings['validation'], 'enabled'> & TargetSelector,
  ): Promise<TargetSettings['validation']> {
    this.logger.debug('Updating target validation settings (input=%o)', input);
    await this.authManager.ensureTargetAccess({
      ...input,
      scope: TargetAccessScope.SETTINGS,
    });

    if (input.targets.length === 0) {
      throw new HiveError(`No targets specified. Required at least one target`);
    }

    return this.storage.updateTargetValidationSettings(input);
  }

  async updateName(
    input: {
      name: string;
    } & TargetSelector,
  ): Promise<Target> {
    const { name, organization, project, target } = input;
    this.logger.info('Updating a target name (input=%o)', input);
    await this.authManager.ensureTargetAccess({
      ...input,
      scope: TargetAccessScope.SETTINGS,
    });
    const user = await this.authManager.getCurrentUser();

    let cleanId = paramCase(name);

    if (await this.storage.getTargetByCleanId({ cleanId, organization, project })) {
      cleanId = paramCase(`${name}-${uuid(4)}`);
    }

    const result = await this.storage.updateTargetName({
      name,
      cleanId,
      organization,
      project,
      target,
      user: user.id,
    });

    await this.activityManager.create({
      type: 'TARGET_NAME_UPDATED',
      selector: {
        organization,
        project,
        target,
      },
      meta: {
        value: name,
      },
    });

    return result;
  }

  async updateTargetGraphQLEndpointUrl(args: {
    organizationId: string;
    projectId: string;
    targetId: string;
    graphqlEndpointUrl: string | null;
  }) {
    await this.authManager.ensureTargetAccess({
      organization: args.organizationId,
      project: args.projectId,
      target: args.targetId,
      scope: TargetAccessScope.SETTINGS,
    });

    const graphqlEndpointUrl = TargetGraphQLEndpointUrlModel.safeParse(args.graphqlEndpointUrl);

    if (graphqlEndpointUrl.success === false) {
      return {
        type: 'error',
        reason: graphqlEndpointUrl.error.message,
      } as const;
    }

    const target = await this.storage.updateTargetGraphQLEndpointUrl({
      organizationId: args.organizationId,
      targetId: args.targetId,
      graphqlEndpointUrl: graphqlEndpointUrl.data,
    });

    if (!target) {
      return {
        type: 'error',
        reason: 'Target not found.',
      } as const;
    }

    return {
      type: 'ok',
      target,
    } as const;
  }

  async getTargetById(args: { targetId: string }): Promise<Target> {
    const breadcrumb = await this.storage.getTargetBreadcrumbForTargetId({
      targetId: args.targetId,
    });

    if (!breadcrumb) {
      throw new Error(`Target not found (targetId=${args.targetId})`);
    }

    const [organizationId, projectId] = await Promise.all([
      this.idTranslator.translateOrganizationId(breadcrumb),
      this.idTranslator.translateProjectId(breadcrumb),
    ]);

    return this.storage.getTarget({
      organization: organizationId,
      project: projectId,
      target: args.targetId,
    });
  }
}

const TargetGraphQLEndpointUrlModel = zod
  .string()
  .max(300, {
    message: 'Must be less than 300 characters.',
  })
  .url()
  .nullable();
