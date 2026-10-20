import { describe, expect, it, vi } from 'vitest';
import { AwsClient, type S3CredentialProvider } from '../../cdn/providers/aws';
import { AuditLogManager, AuditLogS3Config } from './audit-logs-manager';

vi.mock('@hive/workflows/kit', () => ({ TaskScheduler: class {} }));
vi.mock('@hive/workflows/tasks/audit-log-export', () => ({ AuditLogExportTask: {} }));
vi.mock('@sentry/node', () => ({ captureException: vi.fn() }));
vi.mock('../../operations/providers/clickhouse-client', () => ({
  ClickHouse: class {},
  sql: (strings: TemplateStringsArray, ...values: any[]) => ({ strings, values }),
}));
vi.mock('./audit-log-recorder', () => ({
  formatToClickhouseDateTime: (d: Date) => d.toISOString(),
}));
vi.mock('./audit-logs-types', () => ({
  AuditLogClickhouseArrayModel: { parse: (v: any) => v },
}));

function fakeCredentialProvider(keyId: string): S3CredentialProvider {
  return {
    getCredentials: async () => ({ accessKeyId: keyId, secretAccessKey: `${keyId}-secret` }),
  };
}

function createAuditLogManager(fetchImpl: (...args: any[]) => any) {
  const credentialProvider = fakeCredentialProvider('test-key');
  const client = new AwsClient({ credentialProvider, service: 's3' });
  const fetchSpy = vi.spyOn(client, 'fetch').mockImplementation(fetchImpl as any);

  const s3Config = new AuditLogS3Config(client, 'https://s3.example.com', 'audit-bucket');

  const mockSession = {
    assertPerformAction: vi.fn().mockResolvedValue(undefined),
    getViewer: vi.fn().mockResolvedValue({ email: 'user@example.com' }),
  };
  const mockClickHouse = {
    query: vi.fn().mockResolvedValue({
      data: [
        {
          id: '1',
          timestamp: '2026-01-15',
          organizationId: 'org-1',
          eventAction: 'login',
          userId: 'u1',
          userEmail: 'u@x.com',
          accessTokenId: null,
          metadata: '{}',
        },
      ],
    }),
  };
  const mockLogger = { child: () => mockLogger, info: vi.fn(), error: vi.fn() } as any;
  const mockTaskScheduler = { scheduleTask: vi.fn().mockResolvedValue(undefined) };
  const mockStorage = {
    getOrganization: vi.fn().mockResolvedValue({ name: 'TestOrg', id: 'org-1' }),
  };

  return {
    manager: new AuditLogManager(
      mockLogger,
      mockClickHouse as any,
      s3Config,
      mockTaskScheduler as any,
      mockSession as any,
      mockStorage as any,
    ),
    fetchSpy,
  };
}

/**
 * Guards against regression where the S3 PUT upload was missing
 * `aws: { signQuery: true }`, causing the `got` library to receive
 * auth headers it can't handle - resulting in silent upload failures.
 */
describe('AuditLogManager S3 upload uses signQuery', () => {
  it('PUT upload includes aws.signQuery: true', async () => {
    const { manager, fetchSpy } = createAuditLogManager(
      vi.fn().mockResolvedValue({
        ok: true,
        statusCode: 200,
        headers: {},
        url: 'https://s3.example.com/key',
      }),
    );

    await manager.exportAndSendEmail('org-1', {
      startDate: new Date('2026-01-01'),
      endDate: new Date('2026-01-31'),
    });

    const putCall = fetchSpy.mock.calls[0];
    expect(putCall[1]).toEqual(
      expect.objectContaining({
        method: 'PUT',
        aws: expect.objectContaining({ signQuery: true }),
      }),
    );
  });

  it('GET presigned URL includes aws.signQuery: true', async () => {
    const { manager, fetchSpy } = createAuditLogManager(
      vi.fn().mockResolvedValue({
        ok: true,
        statusCode: 200,
        headers: {},
        url: 'https://s3.example.com/key',
      }),
    );

    await manager.exportAndSendEmail('org-1', {
      startDate: new Date('2026-01-01'),
      endDate: new Date('2026-01-31'),
    });

    const getCall = fetchSpy.mock.calls[1];
    expect(getCall[1]).toEqual(
      expect.objectContaining({
        method: 'GET',
        aws: expect.objectContaining({ signQuery: true }),
      }),
    );
  });
});
