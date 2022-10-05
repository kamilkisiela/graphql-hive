const {
  POSTGRES_USER = 'postgres',
  POSTGRES_PASSWORD = 'postgres',
  POSTGRES_HOST = 'localhost',
  POSTGRES_PORT = 5432,
  POSTGRES_DB = 'registry',
  POSTGRES_SSL = null,
  POSTGRES_CONNECTION_STRING = null,
} = process.env;

function cn(dbName = POSTGRES_DB) {
  return (
    POSTGRES_CONNECTION_STRING ||
    `postgres://${POSTGRES_USER}:${POSTGRES_PASSWORD}@${POSTGRES_HOST}:${POSTGRES_PORT}/${dbName}${
      POSTGRES_SSL ? '?sslmode=require' : '?sslmode=disable'
    }`
  );
}

module.exports = cn;
