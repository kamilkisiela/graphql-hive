import { sql } from 'slonik';

export function createConnectionString(config: {
  host: string;
  port: number;
  password: string;
  user: string;
  db: string;
  ssl: boolean;
}) {
  // prettier-ignore
  return `postgres://${config.user}:${config.password}@${config.host}:${config.port}/${config.db}${config.ssl ? '' : '?sslmode=disable'}`;
}

export function objectToParams<T extends Record<string, any>>(
  obj: T,
  transformArray?: <K extends keyof T>(key: K, value: T[K]) => any
) {
  const identifiers = sql.join(
    Object.keys(obj).map(k => sql.identifier([k])),
    sql`, `
  );

  const values = sql.join(
    Object.keys(obj).map(key => {
      if (obj[key] === undefined || obj[key] === null) {
        return null;
      }
      if (Array.isArray(obj[key])) {
        return transformArray!(key, obj[key]);
      }
      if (typeof obj[key] === 'object') {
        return sql.json(obj[key]);
      }
      return obj[key];
    }),
    sql`, `
  );

  return { identifiers, values };
}

export function objectToUpdateParams(obj: Record<string, any>) {
  return sql.join(
    Object.keys(obj).map(key => sql`${sql.identifier([key])} = ${obj[key]}`),
    sql`, `
  );
}

export function toDate(date: Date) {
  return sql`to_timestamp(${date.getTime() / 1000})`;
}
