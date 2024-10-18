import { AlertChannel } from 'packages/services/api/src/shared/entities';
import { vi } from 'vitest';
import { SchemaChangeType } from '@hive/storage';
import { ChannelConfirmationInput, SchemaChangeNotificationInput } from './common';
import { TeamsCommunicationAdapter } from './msteams';

const logger = {
  child: () => ({
    debug: vi.fn(),
    error: vi.fn(),
  }),
};

const appBaseUrl = 'app-base-url';
const webhookUrl = 'webhook-url';

describe('TeamsCommunicationAdapter', () => {
  describe('sendSchemaChangeNotification', () => {
    it('should send schema change notification', async () => {
      const changes = [
        {
          id: 'id-1',
          type: 'FIELD_REMOVED',
          approvalMetadata: null,
          criticality: 'BREAKING',
          message: "Field 'addFoo' was removed from object type 'Mutation'",
          meta: {
            typeName: 'Mutation',
            removedFieldName: 'addFoo',
            isRemovedFieldDeprecated: false,
            typeType: 'object type',
          },
          path: 'Mutation.addFoo',
          isSafeBasedOnUsage: false,
          reason:
            'Removing a field is a breaking change. It is preferable to deprecate the field before removing it.',
          usageStatistics: null,
          breakingChangeSchemaCoordinate: 'Mutation.addFoo',
        },
        {
          id: 'id-2',
          type: 'FIELD_REMOVED',
          approvalMetadata: null,
          criticality: 'BREAKING',
          message: "Field 'foo3' was removed from object type 'Query'",
          meta: {
            typeName: 'Query',
            removedFieldName: 'foo3',
            isRemovedFieldDeprecated: false,
            typeType: 'object type',
          },
          path: 'Query.foo3',
          isSafeBasedOnUsage: false,
          reason:
            'Removing a field is a breaking change. It is preferable to deprecate the field before removing it.',
          usageStatistics: null,
          breakingChangeSchemaCoordinate: 'Query.foo3',
        },
        {
          id: 'id-3',
          type: 'FIELD_ADDED',
          approvalMetadata: null,
          criticality: 'NON_BREAKING',
          message: "Field 'addFooT' was added to object type 'Mutation'",
          meta: {
            typeName: 'Mutation',
            addedFieldName: 'addFooT',
            typeType: 'object type',
          },
          path: 'Mutation.addFooT',
          isSafeBasedOnUsage: false,
          reason: null,
          usageStatistics: null,
          breakingChangeSchemaCoordinate: null,
        },
        {
          id: 'id-4',
          type: 'FIELD_ADDED',
          approvalMetadata: null,
          criticality: 'NON_BREAKING',
          message: "Field 'foo4' was added to object type 'Query'",
          meta: {
            typeName: 'Query',
            addedFieldName: 'foo4',
            typeType: 'object type',
          },
          path: 'Query.foo4',
          isSafeBasedOnUsage: false,
          reason: null,
          usageStatistics: null,
          breakingChangeSchemaCoordinate: null,
        },
      ] as Array<SchemaChangeType>;
      const messages = [] as string[];
      const input = {
        alert: {
          id: 'alert-id',
          type: 'SCHEMA_CHANGE_NOTIFICATIONS',
          channelId: 'channel-id',
          projectId: 'project-id',
          organizationId: 'org-id',
          createdAt: new Date().toISOString(),
          targetId: 'target-id',
        },
        integrations: {
          slack: {
            token: null,
          },
        },
        event: {
          organization: {
            id: 'org-id',
            cleanId: 'org-clean-id',
            slug: 'org-clean-id',
            name: '',
          },
          project: {
            id: 'project-id',
            cleanId: 'project-clean-id',
            slug: 'project-clean-id',
            name: 'project-name',
          },
          target: {
            id: 'target-id',
            cleanId: 'target-clean-id',
            slug: 'target-clean-id',
            name: 'target-name',
          },

          changes,
          messages,
          initial: false,
          errors: [],
          schema: {
            id: 'schema-id',
            commit: 'commit',
            valid: true,
          },
        },
        channel: {
          webhookEndpoint: webhookUrl,
        } as AlertChannel,
      } as SchemaChangeNotificationInput;

      const adapter = new TeamsCommunicationAdapter(logger as any, appBaseUrl);
      const sendTeamsMessageSpy = vi.spyOn(adapter as any, 'sendTeamsMessage');

      await adapter.sendSchemaChangeNotification(input);

      expect(sendTeamsMessageSpy.mock.calls[0]).toMatchInlineSnapshot(`
        [
          webhook-url,
          🐝 Hi, I found *4 changes* in project [project-name](app-base-url/org-clean-id/project-clean-id), target [target-name](app-base-url/org-clean-id/project-clean-id/target-clean-id) ([view details](app-base-url/org-clean-id/project-clean-id/target-clean-id/history/schema-id)):

        ### Breaking changes
         - Field \`addFoo\` was removed from object type \`Mutation\`
         - Field \`foo3\` was removed from object type \`Query\`
        ### Safe changes
         - Field \`addFooT\` was added to object type \`Mutation\`
         - Field \`foo4\` was added to object type \`Query\`
        ,
          [view full report](app-base-url/org-clean-id/project-clean-id/target-clean-id/history/schema-id),
        ]
      `);
    });

    // Add more test cases here if needed
  });
});
describe('sendChannelConfirmation', () => {
  it('should send channel confirmation', async () => {
    const appBaseUrl = 'app-base-url';
    const webhookUrl = 'webhook-url';
    const input = {
      event: {
        organization: {
          id: 'org-id',
          cleanId: 'org-clean-id',
          slug: 'org-clean-id',
        },
        project: {
          id: 'project-id',
          cleanId: 'project-clean-id',
          slug: 'project-clean-id',
          name: 'project-name',
        },
        kind: 'created',
      },
      channel: {
        webhookEndpoint: webhookUrl,
      },
    } as ChannelConfirmationInput;
    const adapter = new TeamsCommunicationAdapter(logger as any, appBaseUrl);
    const sendTeamsMessageSpy = vi.spyOn(adapter as any, 'sendTeamsMessage');
    await adapter.sendChannelConfirmation(input);
    expect(sendTeamsMessageSpy.mock.calls[0]).toMatchInlineSnapshot(`
      [
        webhook-url,
        👋 Hi! I'm the notification 🐝.
      I will send here notifications about your [project-name](app-base-url/org-clean-id/project-clean-id) project.,
      ]
    `);

    input.event.kind = 'deleted';
    await adapter.sendChannelConfirmation(input);
    expect(sendTeamsMessageSpy.mock.calls[1]).toMatchInlineSnapshot(`
      [
        webhook-url,
        👋 Hi! I'm the notification 🐝.
      I will no longer send here notifications about your [project-name](app-base-url/org-clean-id/project-clean-id) project.,
      ]
    `);
  });

  describe('sendTeamsMessage', () => {
    const adapter = new TeamsCommunicationAdapter(logger as any, appBaseUrl);

    beforeAll(() => {
      // @ts-expect-error mocking fetch
      global.fetch = vi.fn(() =>
        Promise.resolve({
          ok: true,
          statusText: 'OK',
        }),
      );
    });

    it('sends a message under 27k characters', async () => {
      const message = 'Short message';
      await adapter.sendTeamsMessage('http://example.com/webhook', message);
      expect(fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: expect.stringContaining(message),
        }),
      );
    });

    it('truncates and appends link for messages over 27k characters', async () => {
      const longMessage = 'a'.repeat(27001);
      const link = 'http://example.com/fullReport';
      await adapter.sendTeamsMessage('http://example.com/webhook', longMessage, link);
      expect(fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: expect.stringContaining('... message truncated. ' + link),
        }),
      );
    });

    it('handles failed send operation', async () => {
      // @ts-expect-error types obviously don't account for the fact this is mocked
      fetch.mockImplementationOnce(() => Promise.resolve({ ok: false, statusText: 'Bad Request' }));

      await expect(
        adapter.sendTeamsMessage('http://example.com/webhook', 'Test message'),
      ).rejects.toThrow('Failed to send Microsoft Teams message: Bad Request');
    });
  });
});
