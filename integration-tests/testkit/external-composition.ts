import * as utils from 'dockest/test-helper';
import { fetch } from '@whatwg-node/fetch';

const port = 3012;
export const container = 'external_composition';
export const address = utils.getServiceAddress(container, port);
export const dockerAddress = `${container}:${port}`;

export async function history(): Promise<string[]> {
  const res = await fetch(`http://${address}/_history`, {
    method: 'GET',
    headers: {
      accept: 'application/json',
      'content-type': 'application/json',
    },
  });

  return res.json();
}
