/* eslint-disable */
const cn = require('../../migrations/tools/db-connection-string.cjs');

module.exports = {
  conn: cn('registry'),
  // Prettier v3 is not supported here yet, but we don't really need it.
  prettier: false,
  skipPrefix: ['supertokens_'],
};
