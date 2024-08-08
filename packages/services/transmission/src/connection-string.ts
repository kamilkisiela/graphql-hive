export function createConnectionString(config: {
  host: string;
  port: number;
  password: string;
  user: string;
  db: string;
  ssl: boolean;
}) {
  // prettier-ignore
  return `postgres://${config.user}:${config.password}@${config.host}:${config.port}/${config.db}${config.ssl ? '?sslmode=require' : '?sslmode=disable'}`;
}
