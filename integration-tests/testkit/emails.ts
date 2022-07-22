import * as utils from 'dockest/test-helper';
import axios from 'axios';

const emailsAddress = utils.getServiceAddress('emails', 3011);

export async function history() {
  const res = await axios.get<
    Array<{
      to: string;
      subject: string;
      body: string;
    }>
  >(`http://${emailsAddress}/_history`, {
    responseType: 'json',
  });

  return res.data;
}
