const {
  POSTGRES_USER = 'postgres',
  POSTGRES_PASSWORD = 'postgres',
  POSTGRES_HOST = 'localhost',
  POSTGRES_PORT = 5432,
  POSTGRES_DB = 'registry',
  POSTGRES_SCHEMA= null,
  POSTGRES_SSL = null,
  POSTGRES_CONNECTION_STRING = null,
} = process.env;

function cn(dbName = POSTGRES_DB, schema = POSTGRES_SCHEMA) {
  let baseConnectionString =
    POSTGRES_CONNECTION_STRING ||
    `postgres://${POSTGRES_USER}:${POSTGRES_PASSWORD}@${POSTGRES_HOST}:${POSTGRES_PORT}/${dbName}`;

  const params = new URLSearchParams({
    sslmode: POSTGRES_SSL ? 'require' : 'disable',
    currentSchema: schema,
  });

  return `${baseConnectionString}?${params.toString()}`;
}

module.exports = cn;
