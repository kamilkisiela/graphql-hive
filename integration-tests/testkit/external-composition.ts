import { getServiceHost } from './utils';

export async function history(): Promise<string[]> {
  const dockerAddress = await getServiceHost('composition_federation_2', 3012);
  const res = await fetch(`http://${dockerAddress}/_history`, {
    method: 'GET',
    headers: {
      accept: 'application/json',
      'content-type': 'application/json',
    },
  });

  return res.json();
}
