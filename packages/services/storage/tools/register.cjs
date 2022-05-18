const { register } = require('esbuild-register/dist/node');

register({ extensions: ['.mjs', '.ts'], format: 'cjs' });
