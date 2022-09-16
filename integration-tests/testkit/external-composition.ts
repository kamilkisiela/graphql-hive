import * as utils from 'dockest/test-helper';
import axios from 'axios';

const port = 3012;
export const container = 'external_composition';
export const address = utils.getServiceAddress(container, port);
export const dockerAddress = `${container}:${port}`;

export async function history() {
  const res = await axios.get<string[]>(`http://${address}/_history`, {
    responseType: 'json',
  });

  return res.data;
}
