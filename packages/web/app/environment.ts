import fs from 'node:fs';
import path from 'node:path';
import { ALLOWED_ENVIRONMENT_VARIABLES } from './src/env/frontend-public-variables';

//
// Runtime environment in Next.js
//

configureRuntimeEnv(ALLOWED_ENVIRONMENT_VARIABLES);

// Writes the environment variables to public/__ENV.js file and make them accessible under `window.__ENV`
function configureRuntimeEnv(publicEnvVars: readonly string[]) {
  const envObject: Record<string, unknown> = {};
  // eslint-disable-next-line no-process-env
  const processEnv = process.env;

  for (const key in processEnv) {
    if (publicEnvVars.includes(key)) {
      envObject[key] = processEnv[key];
    }
  }

  const base = fs.realpathSync(process.cwd());
  const file = `${base}/public/__ENV.js`;
  const content = `window.__ENV = ${JSON.stringify(envObject)};`;
  const dirname = path.dirname(file);

  if (!fs.existsSync(dirname)) {
    fs.mkdirSync(dirname, { recursive: true });
  }

  fs.writeFileSync(file, content);
}
