// It was ported from `bob runify --single` command.
// The idea here is to compile a node service to a single file (not in case of next) and make it executable.
import { join, normalize, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'fs-extra';
import { build as tsup } from 'tsup';

const __dirname = fileURLToPath(new URL('.', import.meta.url));

const requireShim = fs.readFileSync(normalize(join(__dirname, './banner.js')), 'utf-8');

interface BuildOptions {
  external?: string[];
  next?: {
    header?: string;
  };
}

runify(normalize(join(process.cwd(), 'package.json')));

async function runify(packagePath: string) {
  const cwd = packagePath.replace(`${sep}package.json`, '');
  const pkg = await readPackageJson(cwd);
  const buildOptions: BuildOptions = pkg.buildOptions || {};
  console.log(`Building...`);

  if (isNext(pkg)) {
    const additionalRequire = pkg?.buildOptions?.next?.header ?? null;
    await buildWithNext(cwd, additionalRequire);
    await rewritePackageJson(pkg, cwd, newPkg => ({
      ...newPkg,
      dependencies: pkg.dependencies,
      type: 'commonjs',
    }));
  } else {
    await compile(
      cwd,
      'src/index.ts',
      buildOptions,
      Object.keys(pkg.dependencies ?? {}).concat(Object.keys(pkg.devDependencies ?? {})),
      pkg.type === 'module',
    );
    await rewritePackageJson(pkg, cwd);
  }

  console.log(`Built!`);
}

export async function readPackageJson(baseDir: string) {
  return JSON.parse(
    await fs.readFile(resolve(baseDir, 'package.json'), {
      encoding: 'utf-8',
    }),
  );
}

async function rewritePackageJson(
  pkg: Record<string, any>,
  cwd: string,
  modify?: (pkg: any) => any,
) {
  let filename = 'index.js';

  let newPkg: Record<string, any> = {
    bin: filename,
  };
  const fields = ['name', 'version', 'description', 'registry', 'repository', 'type'];

  fields.forEach(field => {
    if (typeof pkg[field] !== 'undefined') {
      newPkg[field] = pkg[field];
    }
  });

  if (modify) {
    newPkg = modify(newPkg);
  }

  await fs.writeFile(join(cwd, 'dist', 'package.json'), JSON.stringify(newPkg, null, 2), {
    encoding: 'utf-8',
  });
}

function isNext(pkg: any): boolean {
  return pkg?.dependencies?.next || pkg?.devDependencies?.next;
}

async function buildWithNext(cwd: string, additionalRequire: string | null) {
  await fs.mkdirp(normalize(join(cwd, 'dist')));
  if (additionalRequire) {
    await tsup({
      entryPoints: [normalize(join(cwd, additionalRequire))],
      outDir: normalize(join(cwd, 'dist')),
      target: 'node20',
      format: ['cjs'],
      splitting: false,
      skipNodeModulesBundle: true,
    });
  }

  const template = await fs.readFile(join(__dirname, 'templates/runify-next.ts'), 'utf-8');

  await Promise.all([
    fs.copy(join(cwd, '.next'), join(cwd, 'dist/.next'), {
      filter(src) {
        // copy without webpack cache (it's 900mb...)
        return src.includes('cache/webpack') === false;
      },
    }),
    fs.copy(join(cwd, 'public'), join(cwd, 'dist/public')),
    fs.writeFile(
      join(cwd, 'dist/index.js'),
      template.replace(
        '// <-- additionalRequire -->',
        additionalRequire ? `require('${additionalRequire.replace('.ts', '')}')` : ``,
      ),
    ),
  ]);
}

async function compile(
  cwd: string,
  entryPoint: string,
  buildOptions: BuildOptions,
  dependencies: string[],
  useEsm = false,
) {
  const out = normalize(join(cwd, 'dist'));

  await tsup({
    entryPoints: [normalize(join(cwd, entryPoint))],
    outDir: out,
    target: 'node20',
    format: [useEsm ? 'esm' : 'cjs'],
    splitting: false,
    sourcemap: true,
    clean: true,
    shims: true,
    skipNodeModulesBundle: false,
    noExternal: dependencies,
    external: buildOptions.external,
    banner: {
      js: requireShim,
    },
  });
}
