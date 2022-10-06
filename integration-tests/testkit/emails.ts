import * as utils from 'dockest/test-helper';
import { fetch } from '@whatwg-node/fetch';

const emailsAddress = utils.getServiceAddress('emails', 3011);

export interface Email {
  to: string;
  subject: string;
  body: string;
}

export async function history(): Promise<Email[]> {
  const response = await fetch(`http://${emailsAddress}/_history`, {
    method: 'GET',
    headers: {
      accept: 'application/json',
      'content-type': 'application/json',
    },
  });

  return response.json();
}
