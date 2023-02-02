import { Errors, Flags } from '@oclif/core';
import { fetch } from '@whatwg-node/fetch';
import Command from '../../base-command';

export default class CdnFetch extends Command {
  static description = 'fetches the schema from CDN';
  static flags = {
    endpoint: Flags.string({
      description: 'cdn endpoint',
    }),
    token: Flags.string({
      description: 'cdn token',
    }),
  };

  async run() {
    const { flags } = await this.parse(CdnFetch);

    const endpoint = this.ensure({
      key: 'endpoint',
      path: 'cdn.endpoint',
      args: flags,
      env: 'HIVE_CDN_ENDPOINT',
    });
    const token = this.ensure({
      key: 'token',
      path: 'cdn.token',
      args: flags,
      env: 'HIVE_CDN_TOKEN',
    });

    try {
      const result = await fetch(endpoint + '/sdl.graphql', {
        headers: {
          'X-Hive-CDN-Key': token,
        },
      });

      const response = await result.text();
      if (result.status >= 300) {
        throw new Error(response);
      }

      this.log(response);
    } catch (error) {
      if (error instanceof Errors.ExitError) {
        throw error;
      } else {
        this.fail('Failed to fetch schema from CDN');
        this.handleFetchError(error);
      }
    }
  }
}
