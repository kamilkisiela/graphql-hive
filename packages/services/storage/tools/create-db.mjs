// @ts-check
import cn from './db-connection-string.mjs';
import pgpFactory from 'pg-promise';

const pgp = pgpFactory();
const db = pgp(cn('postgres'));

const dbName = 'registry';

probe().then(() =>
  db
    .query(`SELECT 1 FROM pg_database WHERE datname = '${dbName}'`)
    .then(result => {
      if (!result.length) {
        console.log(`Creating "${dbName}" database`);
        return db.query(`CREATE DATABASE ${dbName}`);
      }

      console.log(`Database "${dbName}" already exists`);
    })
    .then(() => {
      process.exit(0);
    })
    .catch(error => {
      console.error(error);
      process.exit(1);
    })
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
    console.log('Database not ready. Retry in 1000ms\nReason:\n' + err);
    await new Promise(res => setTimeout(res, 1000));
    return probe(numberOfRetries + 1);
  });
}
