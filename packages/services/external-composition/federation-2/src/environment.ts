import zod from 'zod';

function extractConfig<Input, Output>(config: zod.SafeParseReturnType<Input, Output>): Output {
  if (!config.success) {
    throw new Error('Something went wrong.');
  }
  return config.data;
}

const BaseSchema = zod.object({
  NODE_ENV: zod.string().default('production'),
  ENVIRONMENT: zod.string().default('production'),
  RELEASE: zod.string().default(''),
  PORT: zod.coerce
    .number()
    .transform(port => port || 3069)
    .default(3069),
  SECRET: zod.string(),
});

export function resolveEnv(env: Record<string, string | undefined>) {
  const configs = {
    base: BaseSchema.safeParse(env),
  };

  const environmentErrors: Array<string> = [];

  for (const config of Object.values(configs)) {
    if (config.success === false) {
      environmentErrors.push(JSON.stringify(config.error.format(), null, 4));
    }
  }

  if (environmentErrors.length) {
    const fullError = environmentErrors.join(`\n`);
    console.error('❌ Invalid environment variables:', fullError);
    process.exit(1);
  }

  const base = extractConfig(configs.base);

  return {
    environment: base.ENVIRONMENT,
    release: base.RELEASE ?? 'local',
    http: {
      port: base.PORT,
    },
    secret: base.SECRET,
  };
}

export type ResolvedEnv = ReturnType<typeof resolveEnv>;
