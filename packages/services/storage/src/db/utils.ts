import { sql } from 'slonik';

export function createConnectionString(env: {
  POSTGRES_HOST: string;
  POSTGRES_PORT: string;
  POSTGRES_PASSWORD: string;
  POSTGRES_USER: string;
  POSTGRES_DB: string;
  POSTGRES_CONNECTION_STRING?: string;
  POSTGRES_ENABLE_SSL?: boolean;
}) {
  const {
    POSTGRES_HOST,
    POSTGRES_PORT,
    POSTGRES_PASSWORD,
    POSTGRES_USER,
    POSTGRES_DB,
    POSTGRES_ENABLE_SSL = null,
    POSTGRES_CONNECTION_STRING = null,
  } = env;

  return (
    POSTGRES_CONNECTION_STRING ||
    `postgres://${POSTGRES_USER}:${POSTGRES_PASSWORD}@${POSTGRES_HOST}:${POSTGRES_PORT}/${POSTGRES_DB}${
      POSTGRES_ENABLE_SSL ? '' : '?sslmode=disable'
    }`
  );
}

export function objectToParams<T extends Record<string, any>>(
  obj: T,
  transformArray?: <K extends keyof T>(key: K, value: T[K]) => any
) {
  const identifiers = sql.join(
    Object.keys(obj).map((k) => sql.identifier([k])),
    sql`, `
  );

  const values = sql.join(
    Object.keys(obj).map((key) => {
      if (obj[key] === undefined || obj[key] === null) {
        return null;
      } else if (Array.isArray(obj[key])) {
        return transformArray!(key, obj[key]);
      } else if (typeof obj[key] === 'object') {
        return sql.json(obj[key]);
      } else {
        return obj[key];
      }
    }),
    sql`, `
  );

  return { identifiers, values };
}

export function objectToUpdateParams(obj: Record<string, any>) {
  return sql.join(
    Object.keys(obj).map((key) => sql`${sql.identifier([key])} = ${obj[key]}`),
    sql`, `
  );
}

export function toDate(date: Date) {
  return sql`to_timestamp(${date.getTime() / 1000})`;
}
