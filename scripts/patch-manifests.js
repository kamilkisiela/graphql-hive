/*
  https://github.com/octokit/webhooks-methods.js/issues/45

  That's why we patch package.json of @octokit/webhooks-methods and replace the value of `main` with the value from `source`.
*/

import fs from 'fs';
import path from 'path';
import { createRequire } from 'module';

function patchPackage(name, patchFn) {
  const require = createRequire(import.meta.url);
  const indexFile = require.resolve(name, {
    paths: [path.join(process.cwd(), 'node_modules', '.pnpm', 'node_modules')],
  });
  const nameParts = name.split('/');

  const packagePath = findPackageJson(path.dirname(indexFile), nameParts[nameParts.length - 1]);

  const pkg = JSON.parse(fs.readFileSync(packagePath, 'utf8'));

  patchFn(pkg);

  fs.writeFileSync(packagePath, JSON.stringify(pkg, null, 2), 'utf8');

  console.log(`[patch-manifests] Patched ${name}`);
}

function findPackageJson(dirname, until) {
  const possiblePath = path.join(dirname, 'package.json');

  if (fs.existsSync(possiblePath)) {
    return possiblePath;
  }

  if (dirname.endsWith(until)) {
    throw new Error(`Package.json file not found. Reached ${dirname}`);
  }

  return findPackageJson(path.resolve(dirname, '..'), until);
}

/*
  https://github.com/octokit/webhooks-methods.js/issues/45

  That's why we patch package.json of @octokit/webhooks-methods and replace the value of `main` with the value from `source`.
*/
patchPackage('@octokit/webhooks-methods', pkg => {
  delete pkg.module;
});

/*
  https://github.com/octokit/webhooks-methods.js/issues/45

  That's why we patch package.json of universal-github-app-jwt and replace the value of `main` with the value from `source`.
*/
patchPackage('universal-github-app-jwt', pkg => {
  delete pkg.module;
});

/*
  TSUP (but really esbuild) bundles all node_modules, this is expected, we want that.
  Unfortunately, `apollo-graphql` and `@apollo/*` libraries are CJS only and we end up with CJS and ESM versions of graphql.

  The very quick fix means we need to patch the graphql module to be CJS-only.
*/
patchPackage('graphql', pkg => {
  pkg.main = 'index.js';
  delete pkg.module;
});
