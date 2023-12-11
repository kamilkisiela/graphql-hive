import { fetch } from '@whatwg-node/fetch';
import { getServiceHost } from './utils';

export interface Email {
  to: string;
  subject: string;
  body: string;
}

export async function history(): Promise<Email[]> {
  const emailsAddress = await getServiceHost('emails', 3011);

  const response = await fetch(`http://${emailsAddress}/_history`, {
    method: 'GET',
    headers: {
      accept: 'application/json',
      'content-type': 'application/json',
    },
  });

  return response.json();
}
