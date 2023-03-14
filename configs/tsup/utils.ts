import { readFileSync } from 'fs';
import { join, resolve } from 'path';
import { getPackagesSync } from '@manypkg/get-packages';

const rootDir = resolve(__dirname, '../../');
const libDir = process.cwd();
const packagesMetadata = getPackagesSync(rootDir);
const currentPackage = packagesMetadata.packages.find(p => p.dir === libDir);

export const commonWatchList = () => {
  return [
    libDir + '/src/**/*',
    libDir + '/.env',
    libDir + '/tsconfig.json',
    rootDir + '/tsconfig.json',
    rootDir + '/tsup.config.*',
  ];
};

export const monorepoWatchList = () => {
  if (!currentPackage) {
    return [];
  }

  const internalDeps = Object.entries({
    ...(currentPackage.packageJson.dependencies || {}),
    ...(currentPackage.packageJson.devDependencies || {}),
    ...(currentPackage.packageJson.peerDependencies || {}),
  }).reduce((prev, [name, version]) => {
    if (version === 'workspace:*') {
      return [...prev, name];
    }

    return prev;
  }, [] as string[]);

  return internalDeps.reduce((prev, dep) => {
    const found = packagesMetadata.packages.find(p => p.packageJson.name === dep);

    if (!found) {
      return prev;
    }

    return [...prev, join(found.dir, '/src/**/*')];
  }, [] as string[]);
};

const nodeVersion = readFileSync(join(rootDir, '/.node-version')).toString();

export const targetFromNodeVersion = () => {
  const clean = nodeVersion.trim().split('.');

  return `node${clean[0]}` as any;
};

export const watchEntryPlugin = () => {
  return {
    name: 'node-watch-entry',
    esbuildOptions(options) {
      const entries = (options.entryPoints as string[]) || [];
      const entry = entries[0];

      if (!entry) {
        throw new Error('No entry point found');
      }

      const outFile = entry.replace('src/', 'dist/').replace('.ts', '.js');
      this.options.onSuccess = `node --enable-source-maps ${outFile} | pino-pretty --translateTime HH:MM:ss TT --ignore pid,hostname`;
    },
  };
};
