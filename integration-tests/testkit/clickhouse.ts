import * as utils from 'dockest/test-helper';
import axios from 'axios';

const clickhouseAddress = utils.getServiceAddress('clickhouse', 8123);
const endpoint = `http://${clickhouseAddress}/?default_format=JSON`;

export async function resetClickHouse() {
  const queries = [
    'operation_collection',
    'operations',
    'operations_hourly',
    'operations_daily',
    'coordinates_daily',
    'clients_daily',
  ].map(table => `TRUNCATE TABLE default.${table}`);

  for await (const query of queries) {
    await axios.post(endpoint, query, {
      method: 'POST',
      timeout: 10_000,
      headers: {
        'Accept-Encoding': 'gzip',
        Accept: 'application/json',
        Authorization: `Basic ${Buffer.from('test:test').toString('base64')}`,
      },
    });
  }
}

export async function clickHouseQuery<T>(query: string) {
  const res = await axios.post<{
    data: T[];
    rows: number;
  }>(endpoint, query, {
    timeout: 10_000,
    headers: {
      'Accept-Encoding': 'gzip',
      Authorization: `Basic ${Buffer.from('test:test').toString('base64')}`,
    },
    responseType: 'json',
  });

  return res.data;
}
