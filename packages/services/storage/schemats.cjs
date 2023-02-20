/* eslint-disable */
const cn = require('../../migrations/tools/db-connection-string.cjs');

module.exports = {
  conn: cn('registry'),
  prettier: true,
  skipPrefix: ['supertokens_'],
};
