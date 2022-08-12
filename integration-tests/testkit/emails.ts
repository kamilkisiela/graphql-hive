import * as utils from 'dockest/test-helper';
import axios from 'axios';

const emailsAddress = utils.getServiceAddress('emails', 3011);

export interface Email {
  to: string;
  subject: string;
  body: string;
}

export async function history() {
  const res = await axios.get<Email[]>(`http://${emailsAddress}/_history`, {
    responseType: 'json',
  });

  return res.data;
}
