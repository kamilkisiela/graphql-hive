import { getServiceHost } from './utils';

export interface Email {
  to: string;
  subject: string;
  body: string;
}

export async function history(): Promise<Email[]> {
  const transmissionAddress = await getServiceHost('transmission', 3005);

  const response = await fetch(`http://${transmissionAddress}/emails/_history`, {
    method: 'GET',
    headers: {
      accept: 'application/json',
      'content-type': 'application/json',
    },
  });

  return response.json();
}
