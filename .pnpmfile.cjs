const { readdirSync, readFileSync, existsSync } = require('fs');
const { resolve } = require('path');

function findRoot(startDir = process.cwd()) {
  if (startDir === '/' || startDir === '' || !startDir) {
    return null;
  }

  const files = readdirSync(startDir);
  const hasRootFiles = files.includes('.pnpmfile.cjs');

  if (hasRootFiles) {
    return startDir;
  }

  const parentDir = resolve(startDir, '..');

  return findRoot(parentDir);
}

function resolvePackage(dir) {
  return {
    dir,
    packageJson: JSON.parse(readFileSync(resolve(dir, 'package.json'), 'utf8')),
  };
}

function getPackages(rootDir) {
  const pnpmWorkspaceFile = readFileSync(resolve(rootDir, 'pnpm-workspace.yaml'), 'utf8');
  const globs = pnpmWorkspaceFile
    .split('\n')
    .slice(1)
    .map(v => v.trim().replace('- ', ''))
    .filter(Boolean);

  return globs.flatMap(glob => {
    if (!glob.includes('*')) {
      return [resolvePackage(resolve(rootDir, glob))];
    }

    const dirContents = readdirSync(resolve(rootDir, glob.replace('/*', '')));
    const relevantContents = dirContents.filter(
      dir =>
        !dir.startsWith('.') &&
        !dir.startsWith('node_modules') &&
        !dir.startsWith('dist') &&
        existsSync(resolve(rootDir, glob.replace('*', dir), 'package.json')),
    );

    return relevantContents.map(dir => resolvePackage(resolve(rootDir, glob.replace('*', dir))));
  });
}

const root = findRoot(process.cwd());
const workspacePackages = getPackages(root);

function readPackage(pkg, context) {
  if (pkg.name.startsWith('@hive/')) {
    const workspaceDependencies = Object.entries({
      ...(pkg.dependencies || {}),
      ...(pkg.devDependencies || {}),
    }).filter(([name, version]) => version.startsWith('workspace:') || version.startsWith('.'));

    if (workspaceDependencies.length === 0) {
      return pkg;
    }

    context.log(
      `Package "${pkg.name}" depends on ${workspaceDependencies
        .map(v => v[0])
        .join(', ')} from workspace, copying dependencies...`,
    );

    for (const [name] of workspaceDependencies) {
      const workspacePackage = workspacePackages.find(p => p.packageJson.name === name);

      if (workspacePackage) {
        pkg.dependencies = {
          ...(workspacePackage.packageJson.dependencies || {}),
          ...(pkg.dependencies || {}),
        };

        pkg.devDependencies = {
          ...(workspacePackage.packageJson.devDependencies || {}),
          ...(pkg.devDependencies || {}),
        };
      } else {
        context.log(`Package "${name}" not found in workspace`);
      }
    }
  }

  return pkg;
}

module.exports = {
  hooks: {
    readPackage,
  },
};
