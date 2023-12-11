import { fetch } from '@whatwg-node/fetch';
import { getServiceHost } from './utils';

export const serviceName = 'external_composition';
export const servicePort = 3012;

export async function history(): Promise<string[]> {
  const dockerAddress = await getServiceHost(serviceName, servicePort);
  const res = await fetch(`http://${dockerAddress}/_history`, {
    method: 'GET',
    headers: {
      accept: 'application/json',
      'content-type': 'application/json',
    },
  });

  return res.json();
}
