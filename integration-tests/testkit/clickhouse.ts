/* eslint-disable no-process-env */
import { fetch } from '@whatwg-node/fetch';
import { getServiceHost } from './utils';

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
      Authorization: `Basic ${Buffer.from(
        `${process.env.CLICKHOUSE_USER}:${process.env.CLICKHOUSE_PASSWORD}`,
      ).toString('base64')}`,
    },
  });

  if (response.status !== 200) {
    const body = await response.text();

    throw new Error(`Failed CH query ${query} with status ${response.status} and body:\n${body}`);
  }

  return response.json();
}
