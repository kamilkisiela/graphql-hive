import { Injectable, Scope } from 'graphql-modules';
import lodash from 'lodash';
import { SchemaVersion } from '../../../shared/mappers';
import { Orchestrator, ProjectType } from '../../../shared/entities';
import { atomic, stringifySelector } from '../../../shared/helpers';
import { HiveError } from '../../../shared/errors';
import { AuthManager } from '../../auth/providers/auth-manager';
import { Logger } from '../../shared/providers/logger';
import { Storage, TargetSelector } from '../../shared/providers/storage';
import { CustomOrchestrator } from './orchestrators/custom';
import { FederationOrchestrator } from './orchestrators/federation';
import { SingleOrchestrator } from './orchestrators/single';
import { StitchingOrchestrator } from './orchestrators/stitching';
import { Tracking } from '../../shared/providers/tracking';
import { TargetAccessScope } from '../../auth/providers/target-access';

interface VersionSelector extends TargetSelector {
  version: string;
}

type Paginated<T> = T & {
  after?: string | null;
  limit: number;
};

/**
 * Responsible for auth checks.
 * Talks to Storage.
 */
@Injectable({
  scope: Scope.Operation,
  global: true,
})
export class SchemaManager {
  private logger: Logger;

  constructor(
    logger: Logger,
    private authManager: AuthManager,
    private storage: Storage,
    private singleOrchestrator: SingleOrchestrator,
    private stitchingOrchestrator: StitchingOrchestrator,
    private federationOrchestrator: FederationOrchestrator,
    private customOrchestrator: CustomOrchestrator,
    private tracking: Tracking
  ) {
    this.logger = logger.child({ source: 'SchemaManager' });
  }

  async hasSchema(selector: TargetSelector) {
    this.logger.debug('Checking if schema is available (selector=%o)', selector);
    await this.authManager.ensureTargetAccess({
      ...selector,
      scope: TargetAccessScope.REGISTRY_READ,
    });
    return this.storage.hasSchema(selector);
  }

  async getSchemasOfVersion(
    selector: {
      version: string;
      includeMetadata?: boolean;
    } & TargetSelector
  ) {
    this.logger.debug('Fetching schemas (selector=%o)', selector);
    await this.authManager.ensureTargetAccess({
      ...selector,
      scope: TargetAccessScope.REGISTRY_READ,
    });
    return this.storage.getSchemasOfVersion(selector);
  }

  async getSchemasOfPreviousVersion(
    selector: {
      version: string;
    } & TargetSelector
  ) {
    this.logger.debug('Fetching schemas from the previous version (selector=%o)', selector);
    await this.authManager.ensureTargetAccess({
      ...selector,
      scope: TargetAccessScope.REGISTRY_READ,
    });
    return this.storage.getSchemasOfPreviousVersion(selector);
  }

  async getLatestSchemas(selector: TargetSelector) {
    this.logger.debug('Fetching latest schemas (selector=%o)', selector);
    await this.authManager.ensureTargetAccess({
      ...selector,
      scope: TargetAccessScope.REGISTRY_READ,
    });
    return this.storage.getLatestSchemas(selector);
  }

  async getMaybeLatestValidVersion(selector: TargetSelector) {
    this.logger.debug('Fetching latest valid version (selector=%o)', selector);
    await this.authManager.ensureTargetAccess({
      ...selector,
      scope: TargetAccessScope.REGISTRY_READ,
    });

    const version = await this.storage.getMaybeLatestValidVersion(selector);

    if (!version) {
      return null;
    }

    return {
      ...version,
      project: selector.project,
      target: selector.target,
      organization: selector.organization,
    };
  }

  async getLatestValidVersion(selector: TargetSelector) {
    this.logger.debug('Fetching latest valid version (selector=%o)', selector);
    await this.authManager.ensureTargetAccess({
      ...selector,
      scope: TargetAccessScope.REGISTRY_READ,
    });
    return {
      ...(await this.storage.getLatestValidVersion(selector)),
      project: selector.project,
      target: selector.target,
      organization: selector.organization,
    };
  }

  async getLatestVersion(selector: TargetSelector) {
    this.logger.debug('Fetching latest version (selector=%o)', selector);
    await this.authManager.ensureTargetAccess({
      ...selector,
      scope: TargetAccessScope.REGISTRY_READ,
    });
    return {
      ...(await this.storage.getLatestVersion(selector)),
      project: selector.project,
      target: selector.target,
      organization: selector.organization,
    };
  }

  async getMaybeLatestVersion(selector: TargetSelector) {
    this.logger.debug('Fetching maybe latest version (selector=%o)', selector);
    await this.authManager.ensureTargetAccess({
      ...selector,
      scope: TargetAccessScope.REGISTRY_READ,
    });

    const latest = await this.storage.getMaybeLatestVersion(selector);

    if (!latest) {
      return null;
    }

    return {
      ...latest,
      project: selector.project,
      target: selector.target,
      organization: selector.organization,
    };
  }

  async getSchemaVersion(selector: TargetSelector & { version: string }) {
    this.logger.debug('Fetching single schema version (selector=%o)', selector);
    await this.authManager.ensureTargetAccess({
      ...selector,
      scope: TargetAccessScope.REGISTRY_READ,
    });
    const result = await this.storage.getVersion(selector);

    return {
      project: selector.project,
      target: selector.target,
      organization: selector.organization,
      ...result,
    };
  }

  async getSchemaVersions(selector: Paginated<TargetSelector>) {
    this.logger.debug('Fetching published schemas (selector=%o)', selector);
    await this.authManager.ensureTargetAccess({
      ...selector,
      scope: TargetAccessScope.REGISTRY_READ,
    });
    const result = await this.storage.getVersions(selector);

    return {
      nodes: result.versions.map(r => ({
        ...r,
        project: selector.project,
        target: selector.target,
        organization: selector.organization,
      })),
      hasMore: result.hasMore,
    };
  }

  async updateSchemaVersionStatus(input: TargetSelector & { version: string; valid: boolean }): Promise<SchemaVersion> {
    this.logger.debug('Updating schema version status (input=%o)', input);
    await this.authManager.ensureTargetAccess({
      ...input,
      scope: TargetAccessScope.REGISTRY_WRITE,
    });

    await this.tracking.track({
      event: 'SCHEMA_VERSION_STATUS_UPDATED',
      ...input,
    });

    return {
      ...(await this.storage.updateVersionStatus(input)),
      organization: input.organization,
      project: input.project,
      target: input.target,
    };
  }

  async updateSchemaUrl(
    input: TargetSelector & {
      version: string;
      commit: string;
      url?: string | null;
    }
  ) {
    this.logger.debug('Updating schema version status (input=%o)', input);
    await this.authManager.ensureTargetAccess({
      ...input,
      scope: TargetAccessScope.REGISTRY_WRITE,
    });
    await this.tracking.track({
      event: 'SCHEMA_URL_UPDATED',
      ...input,
    });
    await this.storage.updateSchemaUrlOfVersion(input);
  }

  async getCommit(selector: { commit: string } & TargetSelector) {
    this.logger.debug('Fetching schema (selector=%o)', selector);
    await this.authManager.ensureTargetAccess({
      ...selector,
      scope: TargetAccessScope.REGISTRY_READ,
    });
    return this.storage.getSchema({
      commit: selector.commit,
      target: selector.target,
    });
  }

  @atomic(stringifySelector)
  async getCommits(selector: VersionSelector) {
    this.logger.debug('Fetching schemas (selector=%o)', selector);
    await this.authManager.ensureTargetAccess({
      ...selector,
      scope: TargetAccessScope.REGISTRY_READ,
    });
    return this.storage.getSchemasOfVersion(selector);
  }

  async createVersion(
    input: {
      commit: string;
      schema: string;
      author: string;
      valid: boolean;
      service?: string | null;
      commits: string[];
      url?: string | null;
      base_schema: string | null;
      metadata: string | null;
    } & TargetSelector
  ) {
    this.logger.info('Creating a new version (input=%o)', lodash.omit(input, ['schema']));
    const { valid, project, organization, target, commit, schema, author, commits, url, metadata } = input;
    let service = input.service;

    await this.authManager.ensureTargetAccess({
      project,
      organization,
      target,
      scope: TargetAccessScope.REGISTRY_WRITE,
    });

    if (service) {
      service = service.toLowerCase();
    }

    // if schema exists
    const existingSchema = await this.storage.getMaybeSchema({
      commit,
      service,
      organization,
      project,
      target,
    });

    if (existingSchema) {
      if (service) {
        throw new HiveError(`Only one service schema per commit per target is allowed`);
      }

      throw new HiveError(`Only one schema per commit per target is allowed`);
    }

    // insert new schema
    const insertedSchema = await this.insertSchema({
      organization,
      project,
      target,
      schema,
      service,
      commit,
      author,
      url,
      metadata,
    });

    // finally create a version
    return this.storage.createVersion({
      valid,
      organization,
      project,
      target,
      commit: insertedSchema.id,
      commits: commits.concat(insertedSchema.id),
      url,
      base_schema: input.base_schema,
    });
  }

  matchOrchestrator(projectType: ProjectType): Orchestrator | never {
    switch (projectType) {
      case ProjectType.SINGLE: {
        return this.singleOrchestrator;
      }
      case ProjectType.STITCHING: {
        return this.stitchingOrchestrator;
      }
      case ProjectType.FEDERATION: {
        return this.federationOrchestrator;
      }
      case ProjectType.CUSTOM: {
        return this.customOrchestrator;
      }
      default: {
        throw new HiveError(`Couldn't find an orchestrator for project type "${projectType}"`);
      }
    }
  }

  private async insertSchema(
    input: {
      schema: string;
      commit: string;
      author: string;
      service?: string | null;
      url?: string | null;
      metadata: string | null;
    } & TargetSelector
  ) {
    this.logger.info('Inserting schema (input=%o)', lodash.omit(input, ['schema']));
    await this.authManager.ensureTargetAccess({
      ...input,
      scope: TargetAccessScope.REGISTRY_WRITE,
    });
    return this.storage.insertSchema(input);
  }

  async getBaseSchema(selector: TargetSelector) {
    this.logger.debug('Fetching base schema (selector=%o)', selector);
    await this.authManager.ensureTargetAccess({
      ...selector,
      scope: TargetAccessScope.REGISTRY_READ,
    });
    return await this.storage.getBaseSchema(selector);
  }
  async updateBaseSchema(selector: TargetSelector, newBaseSchema: string | null) {
    this.logger.debug('Updating base schema (selector=%o)', selector);
    await this.authManager.ensureTargetAccess({
      ...selector,
      scope: TargetAccessScope.REGISTRY_READ,
    });
    await this.storage.updateBaseSchema(selector, newBaseSchema);
  }

  async updateServiceName(
    input: TargetSelector & {
      version: string;
      name: string;
      newName: string;
      projectType: ProjectType;
    }
  ) {
    this.logger.debug('Updating service name (input=%o)', input);
    await this.authManager.ensureTargetAccess({
      ...input,
      scope: TargetAccessScope.REGISTRY_WRITE,
    });

    if (input.projectType !== ProjectType.FEDERATION && input.projectType !== ProjectType.STITCHING) {
      throw new HiveError(`Project type "${input.projectType}" doesn't support service name updates`);
    }

    const schemas = await this.storage.getSchemasOfVersion({
      version: input.version,
      target: input.target,
      project: input.project,
      organization: input.organization,
    });

    const schema = schemas.find(s => s.service === input.name);

    if (!schema) {
      throw new HiveError(`Couldn't find service "${input.name}"`);
    }

    if (input.newName.trim().length === 0) {
      throw new HiveError(`Service name can't be empty`);
    }

    const duplicatedSchema = schemas.find(s => s.service === input.newName);

    if (duplicatedSchema) {
      throw new HiveError(`Service "${input.newName}" already exists`);
    }

    await this.storage.updateServiceName({
      organization: input.organization,
      project: input.project,
      target: input.target,
      commit: schema.id,
      name: input.newName,
    });
  }
}
