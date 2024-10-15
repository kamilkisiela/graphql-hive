import { HiveError } from '../../../shared/errors';
import { AuthorizationPolicyStatement, Session } from './authz';

class TestSession extends Session {
  policyStatements: Array<AuthorizationPolicyStatement>;
  constructor(policyStatements: Array<AuthorizationPolicyStatement>) {
    super();
    this.policyStatements = policyStatements;
  }

  public loadPolicyStatementsForOrganization(
    _: string,
  ): Promise<Array<AuthorizationPolicyStatement>> | Array<AuthorizationPolicyStatement> {
    return this.policyStatements;
  }
}

describe('Session.assertPerformAction', () => {
  test('No policies results in rejection', async () => {
    const session = new TestSession([]);
    const result = await session
      .assertPerformAction({
        organizationId: '50b84370-49fc-48d4-87cb-bde5a3c8fd2f',
        resourceType: 'target',
        resourceId: '50b84370-49fc-48d4-87cb-bde5a3c8fd2f',
        action: 'target:view',
      })
      .catch(error => error);
    expect(result).toBeInstanceOf(HiveError);
  });
  test('Single allow policy on specific resource allows action', async () => {
    const session = new TestSession([
      {
        effect: 'allow',
        resource:
          'hrn:aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa:target/bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
        action: 'target:view',
      },
    ]);
    const result = await session
      .assertPerformAction({
        organizationId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
        resourceType: 'target',
        resourceId: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
        action: 'target:view',
      })
      .catch(error => error);
    expect(result).toEqual(undefined);
  });
  test('Single policy on wildcard resource id allows action', async () => {
    const session = new TestSession([
      {
        effect: 'allow',
        resource: 'hrn:aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa:target/*',
        action: 'target:view',
      },
    ]);
    const result = await session
      .assertPerformAction({
        organizationId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
        resourceType: 'target',
        resourceId: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
        action: 'target:view',
      })
      .catch(error => error);
    expect(result).toEqual(undefined);
  });
  test('Single policy on wildcard organization allows action', async () => {
    const session = new TestSession([
      {
        effect: 'allow',
        resource: 'hrn:*:target/bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
        action: 'target:view',
      },
    ]);
    const result = await session
      .assertPerformAction({
        organizationId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
        resourceType: 'target',
        resourceId: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
        action: 'target:view',
      })
      .catch(error => error);
    expect(result).toEqual(undefined);
  });
  test('Single policy on wildcard organization and resource id allows action', async () => {
    const session = new TestSession([
      {
        effect: 'allow',
        resource: 'hrn:*:target/*',
        action: 'target:view',
      },
    ]);
    const result = await session
      .assertPerformAction({
        organizationId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
        resourceType: 'target',
        resourceId: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
        action: 'target:view',
      })
      .catch(error => error);
    expect(result).toEqual(undefined);
  });
  test('Single policy on wildcard resource allows action', async () => {
    const session = new TestSession([
      {
        effect: 'allow',
        resource: 'hrn:aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa:*',
        action: 'target:view',
      },
    ]);
    await session.assertPerformAction({
      organizationId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      resourceType: 'target',
      resourceId: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
      action: 'target:view',
    });
  });
  test('Single policy on different organization disallows action', async () => {
    const session = new TestSession([
      {
        effect: 'allow',
        resource: 'hrn:cccccccc-cccc-cccc-cccc-cccccccccccc:*',
        action: 'target:view',
      },
    ]);
    const result = await session
      .assertPerformAction({
        organizationId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
        resourceType: 'target',
        resourceId: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
        action: 'target:view',
      })
      .catch(error => error);
    expect(result).toBeInstanceOf(HiveError);
  });
  test('A single deny policy always disallows action', async () => {
    const session = new TestSession([
      {
        effect: 'allow',
        resource: 'hrn:*:*',
        action: 'target:view',
      },
      {
        effect: 'deny',
        resource: 'hrn:*:*',
        action: 'target:view',
      },
    ]);
    const result = await session
      .assertPerformAction({
        organizationId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
        resourceType: 'target',
        resourceId: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
        action: 'target:view',
      })
      .catch(error => error);
    expect(result).toBeInstanceOf(HiveError);
  });
});
