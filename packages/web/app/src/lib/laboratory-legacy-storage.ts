import { Kit } from '@/lib/kit';

const OLD_ENV_KEY = 'hive:laboratory:environment';
const OLD_ENABLED_KEY = 'hive:laboratory:isPreflightScriptEnabled';
const ENV_KEY = 'hive:laboratory:env';
const ENABLED_KEY = 'hive:laboratory:preflightEnabled';
// Everything else the GraphiQL tab left behind: its page switch, its welcome dialog, its drafts
// and GraphiQL's own store.
const LEGACY_KEYS = [
  'hive:laboratory:type',
  'hive:laboratory:welcome-dialog-shown',
  OLD_ENV_KEY,
  OLD_ENABLED_KEY,
];
const LEGACY_PREFIXES = ['hive:operation-', 'graphiql:'];

// The GraphiQL tab kept env as raw editor text and the toggle as a JSON boolean. Copies only
// when the lab key is missing, then clears what the removed tab left behind.
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

  for (const key of legacyKeys()) {
    localStorage.removeItem(key);
  }
}

function legacyKeys() {
  const keys = Array.from({ length: localStorage.length }, (_, i) => localStorage.key(i) ?? '');

  return keys.filter(
    key => LEGACY_KEYS.includes(key) || LEGACY_PREFIXES.some(prefix => key.startsWith(prefix)),
  );
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
