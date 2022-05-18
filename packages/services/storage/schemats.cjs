const { register } = require('esbuild-register/dist/node');

register({
  format: 'cjs',
});

const cn = require('./tools/db-connection-string.mjs').default;

module.exports = {
  conn: cn('registry'),
  prettier: true,
};
