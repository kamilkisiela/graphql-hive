import { Injectable, Scope } from 'graphql-modules';
import { paramCase } from 'param-case';
import type { Target, TargetSettings } from '../../../shared/entities';
import { HiveError } from './../../../shared/errors';
import { AuthManager } from '../../auth/providers/auth-manager';
import { Logger } from '../../shared/providers/logger';
import { Storage, ProjectSelector, TargetSelector } from '../../shared/providers/storage';
import { share, uuid } from '../../../shared/helpers';
import { ActivityManager } from '../../activity/providers/activity-manager';
import { TokenStorage } from '../../token/providers/token-storage';
import { Tracking } from '../../shared/providers/tracking';
import { ProjectAccessScope } from '../../auth/providers/project-access';
import { TargetAccessScope } from '../../auth/providers/target-access';

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
    private tracking: Tracking
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
    this.logger.info('Creating a target (name=%s, project=%s, organization=%s)', name, project, organization);
    await this.authManager.ensureProjectAccess({
      project,
      organization,
      scope: ProjectAccessScope.READ,
    });

    let cleanId = paramCase(name);

    if (await this.storage.getTargetByCleanId({ cleanId, project, organization })) {
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
    this.logger.info('Deleting a target (target=%s, project=%s, organization=%s)', target, project, organization);
    await this.authManager.ensureTargetAccess({
      project,
      organization,
      target,
      scope: TargetAccessScope.DELETE,
    });

    // create target
    const [result] = await Promise.all([
      this.storage.deleteTarget({
        target,
        project,
        organization,
      }),
      this.tokenStorage.invalidateTarget({
        target,
        project,
        organization,
      }),
    ]);

    await this.activityManager.create({
      type: 'TARGET_DELETED',
      selector: {
        organization,
        project,
      },
      meta: {
        name: result.name,
        cleanId: result.cleanId,
      },
    });

    return result;
  }

  async getTargets(selector: ProjectSelector): Promise<readonly Target[]> {
    this.logger.debug('Fetching targets (selector=%o)', selector);
    await this.authManager.ensureProjectAccess({
      ...selector,
      scope: ProjectAccessScope.READ,
    });
    return this.storage.getTargets(selector);
  }

  async getTarget(selector: TargetSelector): Promise<Target> {
    this.logger.debug('Fetching target (selector=%o)', selector);
    await this.authManager.ensureTargetAccess({
      ...selector,
      scope: TargetAccessScope.READ,
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
      scope: TargetAccessScope.READ,
    });

    return this.storage.getTargetSettings(selector);
  }

  async setTargetValidaton(
    input: {
      enabled: boolean;
    } & TargetSelector
  ): Promise<TargetSettings['validation']> {
    this.logger.debug('Setting target validation (input=%o)', input);
    await this.authManager.ensureTargetAccess({
      ...input,
      scope: TargetAccessScope.SETTINGS,
    });

    await this.tracking.track({
      event: input.enabled ? 'TARGET_VALIDATION_ENABLED' : 'TARGET_VALIDATION_DISABLED',
      data: {
        ...input,
      },
    });

    return this.storage.setTargetValidation(input);
  }

  async updateTargetValidatonSettings(
    input: Omit<TargetSettings['validation'], 'enabled'> & TargetSelector
  ): Promise<TargetSettings['validation']> {
    this.logger.debug('Updating target validation settings (input=%o)', input);
    await this.authManager.ensureTargetAccess({
      ...input,
      scope: TargetAccessScope.SETTINGS,
    });

    await this.tracking.track({
      event: 'TARGET_VALIDATION_UPDATED',
      data: {
        ...input,
      },
    });

    if (input.targets.length === 0) {
      throw new HiveError(`No targets specified. Required at least one target`);
    }

    // TODO: validation of percentage (0 - 100) and period (1 - 30)
    return this.storage.updateTargetValidationSettings(input);
  }

  async updateName(
    input: {
      name: string;
    } & TargetSelector
  ): Promise<Target> {
    const { name, organization, project, target } = input;
    this.logger.info('Updating a target name (input=%o)', input);
    await this.authManager.ensureTargetAccess({
      ...input,
      scope: TargetAccessScope.SETTINGS,
    });
    const user = await this.authManager.getCurrentUser();

    const result = await this.storage.updateTargetName({
      name,
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
}
