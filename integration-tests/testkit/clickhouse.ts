/* eslint-disable no-process-env */
import { ensureEnv } from './env';
import { getServiceHost } from './utils';

const user = ensureEnv('CLICKHOUSE_USER');
const password = ensureEnv('CLICKHOUSE_PASSWORD');
const credentials = Buffer.from(`${user}:${password}`).toString('base64');

export async function clickHouseQuery<T>(query: string): Promise<{
  data: T[];
  rows: number;
}> {
  const clickhouseAddress = await getServiceHost('clickhouse', 8123);
  const endpoint = `http://${clickhouseAddress}/?default_format=JSON`;
  const response = await fetch(endpoint, {
    method: 'POST',
    body: query,
    headers: {
      Accept: 'application/json',
      'Accept-Encoding': 'gzip',
      Authorization: `Basic ${credentials}`,
    },
  });

  if (response.status !== 200) {
    const body = await response.text();

    throw new Error(`Failed CH query ${query} with status ${response.status} and body:\n${body}`);
  }

  return response.json();
}
