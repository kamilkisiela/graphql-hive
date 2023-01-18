// @ts-check
import pgpFactory from 'pg-promise';
import cn from './db-connection-string.cjs';

const pgp = pgpFactory();
const db = pgp(cn('postgres'));

const dbName = 'registry';

// eslint-disable-next-line no-undef
const log = console.log;

probe().then(() =>
  db
    .query(`SELECT 1 FROM pg_database WHERE datname = '${dbName}'`)
    .then(result => {
      if (!result.length) {
        log(`Creating "${dbName}" database`);
        return db.query(`CREATE DATABASE ${dbName}`);
      }

      log(`Database "${dbName}" already exists`);
    })
    .then(() => {
      // eslint-disable-next-line no-undef
      process.exit(0);
    })
    .catch(error => {
      // eslint-disable-next-line no-undef
      console.error(error);
      // eslint-disable-next-line no-undef
      process.exit(1);
    }),
);

/**
 *
 * @param {number} numberOfRetries
 * @returns {any}
 */
function probe(numberOfRetries = 0) {
  return db.any(`SELECT 1`).catch(async err => {
    if (numberOfRetries === 15) {
      throw new Error('Database not ready after 15 retries. Exiting.');
    }
    log('Database not ready. Retry in 1000ms\nReason:\n' + err);
    // eslint-disable-next-line no-undef
    await new Promise(res => setTimeout(res, 1000));
    return probe(numberOfRetries + 1);
  });
}
