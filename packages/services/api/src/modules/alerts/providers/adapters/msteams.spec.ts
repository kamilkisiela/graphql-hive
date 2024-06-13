import { vi } from 'vitest';
import { TeamsCommunicationAdapter } from './msteams';

describe('TeamsCommunicationAdapter', () => {
  describe('sendSchemaChangeNotification', () => {
    it('should send', async () => {
      // console.log('TeamsCommunicationAdapter', TeamsCommunicationAdapter);
      const adapter = new TeamsCommunicationAdapter(
        {
          child: () => ({
            debug: vi.fn(),
            error: vi.fn(),
            info: vi.fn(),
            warn: vi.fn(),
          }),
        } as any,
        'app-base-url',
      );
      // const input = {
      //   event: {
      //     organization: {
      //       id: 'org-id',
      //     },
      //     project: {
      //       id: 'project-id',
      //     },
      //     target: {
      //       id: 'target-id',
      //     },
      //     changes: [],
      //     messages: [],
      //     initial: false,
      //   },
      //   integrations: {
      //     teams: {
      //       webhookUrl: 'webhook-url',
      //     },
      //   },
      // };
      // await expect(adapter.sendSchemaChangeNotification(input)).resolves.toBeUndefined();
    });
  });
});
