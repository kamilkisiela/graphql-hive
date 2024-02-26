/**
 * Why? Few reasons:
 * - tsup treats dependencies as external code and does not bundle them
 * - without dependencies turborepo will always serve stale code when some of dependencies changed
 *
 * Moving internal dependencies to devDependencies makes tsup treat them as non-external and turborepo still keep tracks of relations
 */

/// @ts-check
const path = require('path');
const fs = require('fs');
const { minimatch } = require('minimatch');
const readPkgUp = require('eslint-module-utils/readPkgUp').default;
const moduleVisitor = require('eslint-module-utils/moduleVisitor').default;

function isHivePackage(packageName, scopes) {
  return (
    typeof packageName === 'string' && scopes.some(scope => packageName.startsWith(`${scope}/`))
  );
}

const depFieldCache = new Map();

function hasKeys(obj = {}) {
  return Object.keys(obj).length > 0;
}

function extractDepFields(pkg) {
  return {
    name: pkg.name,
    dependencies: pkg.dependencies || {},
    devDependencies: pkg.devDependencies || {},
    optionalDependencies: pkg.optionalDependencies || {},
    peerDependencies: pkg.peerDependencies || {},
  };
}

function getDependencies(context, packageDir) {
  let paths = [];
  try {
    const packageContent = {
      name: '',
      dependencies: {},
      devDependencies: {},
      optionalDependencies: {},
      peerDependencies: {},
    };

    if (packageDir && packageDir.length > 0) {
      if (!Array.isArray(packageDir)) {
        paths = [path.resolve(packageDir)];
      } else {
        paths = packageDir.map(dir => path.resolve(dir));
      }
    }

    if (paths.length > 0) {
      // use rule config to find package.json
      paths.forEach(dir => {
        const packageJsonPath = path.join(dir, 'package.json');
        if (!depFieldCache.has(packageJsonPath)) {
          const depFields = extractDepFields(JSON.parse(fs.readFileSync(packageJsonPath, 'utf8')));
          depFieldCache.set(packageJsonPath, depFields);
        }
        const _packageContent = depFieldCache.get(packageJsonPath);
        Object.keys(packageContent).forEach(depsKey =>
          Object.assign(packageContent[depsKey], _packageContent[depsKey]),
        );
      });
    } else {
      // use closest package.json
      Object.assign(
        packageContent,
        extractDepFields(
          readPkgUp({
            cwd: context.getPhysicalFilename
              ? context.getPhysicalFilename()
              : context.getFilename(),
            normalize: false,
          }).pkg,
        ),
      );
    }

    if (
      ![
        packageContent.dependencies,
        packageContent.devDependencies,
        packageContent.optionalDependencies,
        packageContent.peerDependencies,
      ].some(hasKeys)
    ) {
      return null;
    }

    return packageContent;
  } catch (e) {
    if (paths.length > 0 && e.code === 'ENOENT') {
      context.report({
        message: 'The package.json file could not be found.',
        loc: { line: 0, column: 0 },
      });
    }
    if (e.name === 'JSONError' || e instanceof SyntaxError) {
      context.report({
        message: 'The package.json file could not be parsed: ' + e.message,
        loc: { line: 0, column: 0 },
      });
    }

    return null;
  }
}

function missingErrorMessage(packageName) {
  return `'${packageName}' should be listed in the project's devDependencies. `;
}

function directDepErrorMessage(packageName) {
  return `'${packageName}' should be listed in the project's devDependencies, not dependencies.`;
}

function optDepErrorMessage(packageName) {
  return `'${packageName}' should be listed in the project's devDependencies, not optionalDependencies`;
}

function peerDepErrorMessage(packageName) {
  return `'${packageName}' should be listed in the project's devDependencies, not peerDependencies`;
}

function getModuleOriginalName(name) {
  const [first, second] = name.split('/');
  return first.startsWith('@') ? `${first}/${second}` : first;
}

function checkDependencyDeclaration(deps, packageName, declarationStatus) {
  const newDeclarationStatus = declarationStatus || {
    isInDeps: false,
    isInDevDeps: false,
    isInOptDeps: false,
    isInPeerDeps: false,
  };

  // in case of sub package.json inside a module
  // check the dependencies on all hierarchy
  const packageHierarchy = [];
  const packageNameParts = packageName ? packageName.split('/') : [];
  packageNameParts.forEach((namePart, index) => {
    if (!namePart.startsWith('@')) {
      const ancestor = packageNameParts.slice(0, index + 1).join('/');
      packageHierarchy.push(ancestor);
    }
  });

  return packageHierarchy.reduce((result, ancestorName) => {
    return {
      isInDeps: result.isInDeps || deps.dependencies[ancestorName] !== undefined,
      isInDevDeps: result.isInDevDeps || deps.devDependencies[ancestorName] !== undefined,
      isInOptDeps: result.isInOptDeps || deps.optionalDependencies[ancestorName] !== undefined,
      isInPeerDeps: result.isInPeerDeps || deps.peerDependencies[ancestorName] !== undefined,
    };
  }, newDeclarationStatus);
}

function reportIfMissing(context, deps, node, name, scopes) {
  if (node.importKind === 'type' || node.importKind === 'typeof') {
    return;
  }

  if (!isHivePackage(name, scopes)) {
    return;
  }

  const importPackageName = getModuleOriginalName(name);
  let declarationStatus = checkDependencyDeclaration(deps, importPackageName);

  if (declarationStatus.isInDevDeps) {
    return;
  }

  if (declarationStatus.isInDeps) {
    context.report(node, directDepErrorMessage(importPackageName));
    return;
  }

  if (declarationStatus.isInOptDeps) {
    context.report(node, optDepErrorMessage(importPackageName));
    return;
  }

  if (declarationStatus.isInPeerDeps) {
    context.report(node, peerDepErrorMessage(importPackageName));
    return;
  }

  context.report(node, missingErrorMessage(importPackageName));
}

module.exports = {
  meta: {
    type: 'problem',
  },

  create(context) {
    const options = context.options[0] || {};
    const deps = getDependencies(context, options.packageDir) || extractDepFields({});

    if (Array.isArray(options.ignored)) {
      const filepath = context.getPhysicalFilename
        ? context.getPhysicalFilename()
        : context.getFilename();

      if (
        options.ignored.some(
          ignored =>
            minimatch(filepath, ignored) || minimatch(filepath, path.join(process.cwd(), ignored)),
        )
      ) {
        return {};
      }
    }

    if (!Array.isArray(options.scopes)) {
      throw new Error('[hive/enforce-deps-in-dev] The scopes option must be an array.');
    }

    return moduleVisitor(
      (source, node) => {
        reportIfMissing(context, deps, node, source.value, options.scopes);
      },
      { commonjs: true },
    );
  },
};
