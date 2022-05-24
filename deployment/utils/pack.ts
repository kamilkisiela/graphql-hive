import { resolve } from 'path';
import { getPackagesSync } from '@manypkg/get-packages';
import { execSync } from 'child_process';

export function createPackageHelper(dir = resolve(process.cwd(), '../')) {
  const { packages } = getPackagesSync(dir);
  const revision = execSync('git rev-parse HEAD')
    .toString()
    .trim()
    .replace(/\r?\n|\r/g, '');

  return {
    currentReleaseId: () => revision,
    npmPack(name: string): PackageInfo {
      const dir = packages.find(p => p.packageJson.name === name)?.dir;

      if (!dir) {
        throw new Error(`Failed to find package "${name}" in workspace!`);
      }

      const distDir = resolve(dir, './dist/');
      const fileName = execSync('npm pack --pack-destination ../', {
        cwd: distDir,
        stdio: ['ignore', 'pipe', 'ignore'],
      })
        .toString()
        .trim()
        .replace(/\r?\n|\r/g, '');

      // TODO: maybe manypkg can give it to us?
      const withoutOrg = name.split('/');
      const packName = withoutOrg.length === 2 ? withoutOrg[1] : withoutOrg[0];
      const binName = packName.split('@')[0];

      return {
        runtime: 'node',
        name,
        file: resolve(dir, fileName),
        bin: binName,
      };
    },
  };
}

export type PackageHelper = ReturnType<typeof createPackageHelper>;
export type PackageInfo = {
  runtime: 'node' | 'rust';
  name: string;
  file: string;
  bin: string;
};
