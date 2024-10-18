import { Injectable, Scope } from 'graphql-modules';
import * as zod from 'zod';
import type { Target, TargetSettings } from '../../../shared/entities';
import { share } from '../../../shared/helpers';
import { AuthManager } from '../../auth/providers/auth-manager';
import { ProjectAccessScope } from '../../auth/providers/project-access';
import { TargetAccessScope } from '../../auth/providers/target-access';
import { ActivityManager } from '../../shared/providers/activity-manager';
import { IdTranslator } from '../../shared/providers/id-translator';
import { Logger } from '../../shared/providers/logger';
import { ProjectSelector, Storage, TargetSelector } from '../../shared/providers/storage';
import { TokenStorage } from '../../token/providers/token-storage';
import { HiveError } from './../../../shared/errors';

const reservedSlugs = ['view', 'new'];

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
    slug,
    project,
    organization,
  }: {
    slug: string;
  } & ProjectSelector): Promise<
    | {
        ok: true;
        target: Target;
      }
    | {
        ok: false;
        message: string;
      }
  > {
    this.logger.info(
      'Creating a target (slug=%s, project=%s, organization=%s)',
      slug,
      project,
      organization,
    );
    await this.authManager.ensureProjectAccess({
      project,
      organization,
      scope: ProjectAccessScope.READ,
    });

    if (reservedSlugs.includes(slug)) {
      return {
        ok: false,
        message: 'Slug is reserved',
      };
    }

    // create target
    const result = await this.storage.createTarget({
      slug,
      project,
      organization,
    });

    if (result.ok) {
      await this.activityManager.create({
        type: 'TARGET_CREATED',
        selector: {
          organization,
          project,
          target: result.target.id,
        },
      });
    }

    return result;
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
        cleanId: deletedTarget.slug,
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

  async updateSlug(
    input: {
      slug: string;
    } & TargetSelector,
  ): Promise<
    | {
        ok: true;
        target: Target;
      }
    | {
        ok: false;
        message: string;
      }
  > {
    const { slug, organization, project, target } = input;
    this.logger.info('Updating a target slug (input=%o)', input);
    await this.authManager.ensureTargetAccess({
      ...input,
      scope: TargetAccessScope.SETTINGS,
    });
    const user = await this.authManager.getCurrentUser();

    if (reservedSlugs.includes(slug)) {
      return {
        ok: false,
        message: 'Slug is reserved',
      };
    }

    const result = await this.storage.updateTargetSlug({
      slug,
      organization,
      project,
      target,
      user: user.id,
    });

    if (result.ok) {
      await this.activityManager.create({
        type: 'TARGET_ID_UPDATED',
        selector: {
          organization,
          project,
          target,
        },
        meta: {
          value: slug,
        },
      });
    }

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

  /**
   * @deprecated It's a temporary method to force legacy composition in targets, when native composition is enabled for a project.
   */
  async updateTargetSchemaComposition(args: {
    organizationId: string;
    projectId: string;
    targetId: string;
    nativeComposition: boolean;
  }) {
    await this.authManager.ensureTargetAccess({
      organization: args.organizationId,
      project: args.projectId,
      target: args.targetId,
      scope: TargetAccessScope.SETTINGS,
    });

    this.logger.info(
      `Updating target schema composition (targetId=%s, nativeComposition=%s)`,
      args.targetId,
      args.nativeComposition,
    );

    const target = await this.storage.updateTargetSchemaComposition({
      organizationId: args.organizationId,
      projectId: args.projectId,
      targetId: args.targetId,
      nativeComposition: args.nativeComposition,
    });

    return target;
  }
}

const TargetGraphQLEndpointUrlModel = zod
  .string()
  .max(300, {
    message: 'Must be less than 300 characters.',
  })
  .url()
  .nullable();
