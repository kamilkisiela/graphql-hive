import { parse } from 'pg-connection-string';
import * as pulumi from '@pulumi/pulumi';
import { ServiceSecret } from '../utils/secrets';

export class PostgresConnectionSecret extends ServiceSecret<{
  host: string | pulumi.Output<string>;
  port: string | pulumi.Output<string>;
  user: string | pulumi.Output<string>;
  password: string | pulumi.Output<string>;
  database: string | pulumi.Output<string>;
  ssl: '0' | '1' | pulumi.Output<'0' | '1'>;
  connectionString: pulumi.Output<string>;
  connectionStringPostgresql: pulumi.Output<string>;
}> {}

/**
 * https://chat.openai.com/share/0892e60c-8413-4e66-9abe-e5d22aa7e7ae
 */
const regex = /(postgres(?:ql)?:\/\/[^:\/\s]+)(:\d+)?(\/[^?]*\??[^#]*)/;

export function deployPostgres() {
  const postgresConfig = new pulumi.Config('postgres');
  const rawConnectionString = postgresConfig.requireSecret('connectionString');
  const connectionString = rawConnectionString.apply(rawConnectionString =>
    parse(rawConnectionString),
  );

  const rawPgBouncerConnectionString = rawConnectionString.apply(rawConnectionString =>
    rawConnectionString.replace(regex, `$1:${6432}$3`),
  );

  const secret = new PostgresConnectionSecret('postgres', {
    connectionString: rawConnectionString,
    connectionStringPostgresql: rawConnectionString.apply(str =>
      str.replace('postgres://', 'postgresql://'),
    ),
    host: connectionString.apply(connection => connection.host ?? ''),
    port: connectionString.apply(connection => connection.port || '5432'),
    user: connectionString.apply(connection => connection.user ?? ''),
    password: connectionString.apply(connection => connection.password ?? ''),
    database: connectionString.apply(connection => connection.database ?? ''),
    ssl: connectionString.apply(connection => (connection.ssl ? '1' : '0')),
  });

  const pgBouncerSecret = new PostgresConnectionSecret('postgres-bouncer', {
    connectionString: rawPgBouncerConnectionString,
    connectionStringPostgresql: rawPgBouncerConnectionString.apply(str =>
      str.replace('postgres://', 'postgresql://'),
    ),
    host: connectionString.apply(connection => connection.host ?? ''),
    port: '6432',
    user: connectionString.apply(connection => connection.user ?? ''),
    password: connectionString.apply(connection => connection.password ?? ''),
    database: connectionString.apply(connection => connection.database ?? ''),
    ssl: connectionString.apply(connection => (connection.ssl ? '1' : '0')),
  });

  return { secret, pgBouncerSecret };
}

export type Postgres = ReturnType<typeof deployPostgres>;
