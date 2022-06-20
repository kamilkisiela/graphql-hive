const cn = require('./tools/db-connection-string.cjs');

module.exports = {
  conn: cn('registry'),
  prettier: true,
};
