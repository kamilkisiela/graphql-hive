import { Injectable, Scope } from 'graphql-modules';
import { AuthManager } from '../../auth/providers/auth-manager';
import { Logger } from '../../shared/providers/logger';
import { Storage } from '../../shared/providers/storage';
import { atomic } from '../../../shared/helpers';
import { OperationsReader } from '../../operations/providers/operations-reader';

/**
 * Responsible for auth checks.
 * Talks to Storage.
 */
@Injectable({
  scope: Scope.Operation,
})
export class AdminManager {
  private logger: Logger;

  constructor(
    logger: Logger,
    private storage: Storage,
    private authManager: AuthManager,
    private operationsReader: OperationsReader
  ) {
    this.logger = logger.child({ source: 'AdminManager' });
  }

  async getStats(daysLimit?: number | null) {
    this.logger.debug('Fetching admin stats');
    const user = await this.authManager.getCurrentUser();

    if (!user.isAdmin) {
      throw new Error('GO AWAY');
    }

    return this.storage.adminGetStats(daysLimit);
  }

  async getOperationsOverTime({ daysLimit }: { daysLimit: number }) {
    this.logger.debug('Fetching collected operations over time (admin, daysLimit=%s)', daysLimit);
    const user = await this.authManager.getCurrentUser();

    if (!user.isAdmin) {
      throw new Error('GO AWAY');
    }

    const points = await this.operationsReader.adminOperationsOverTime({
      daysLimit,
    });

    return points.map(point => ({
      date: point.date,
      count: point.total,
    }));
  }

  @atomic((arg: { daysLimit: number }) => arg.daysLimit + '')
  async countOperationsPerOrganization({ daysLimit }: { daysLimit: number }) {
    this.logger.info('Counting collected operations per organization (admin, daysLimit=%s)', daysLimit);
    const user = await this.authManager.getCurrentUser();

    if (user.isAdmin) {
      const pairs = await this.storage.adminGetOrganizationsTargetPairs();
      const operations = await this.operationsReader.adminCountOperationsPerTarget({
        daysLimit,
      });

      const organizationCountMap = new Map<string, number>();
      const targetOrganizationMap = new Map<string, string>(pairs.map(p => [p.target, p.organization]));

      for (const op of operations) {
        const organizationId = targetOrganizationMap.get(op.target);

        if (organizationId) {
          const total = organizationCountMap.get(organizationId);
          organizationCountMap.set(organizationId, (total ?? 0) + op.total);
        }
      }

      return Array.from(organizationCountMap.entries()).map(entry => ({
        organization: entry[0],
        total: entry[1],
      }));
    }

    throw new Error('Go away');
  }
}
