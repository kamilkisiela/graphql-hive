import { Kit } from '@/lib/kit';

const OLD_ENV_KEY = 'hive:laboratory:environment';
const OLD_ENABLED_KEY = 'hive:laboratory:isPreflightScriptEnabled';
const ENV_KEY = 'hive:laboratory:env';
const ENABLED_KEY = 'hive:laboratory:preflightEnabled';

// The GraphiQL tab kept env as raw editor text and the toggle as a JSON boolean. Writes only
// when the lab key is missing; the old keys stay until that tab is removed.
export function migrateLegacyLaboratoryStorage() {
  if (!localStorage.getItem(ENV_KEY)) {
    const variables = legacyEnvVariables(localStorage.getItem(OLD_ENV_KEY));

    if (variables) {
      localStorage.setItem(ENV_KEY, JSON.stringify({ variables }));
    }
  }

  if (!localStorage.getItem(ENABLED_KEY)) {
    const enabled = localStorage.getItem(OLD_ENABLED_KEY);

    if (enabled === 'true' || enabled === 'false') {
      localStorage.setItem(ENABLED_KEY, enabled);
    }
  }
}

function legacyEnvVariables(raw: string | null): Record<string, string> | null {
  if (!raw) {
    return null;
  }

  let parsed: unknown;

  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return null;
  }

  return Object.fromEntries(
    Object.entries(parsed)
      .filter(([, value]) => Kit.Json.isPrimitive(value))
      .map(([key, value]) => [key, String(value)]),
  );
}
