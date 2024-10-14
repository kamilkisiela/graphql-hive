export function getAllEnv(): Record<string, string | undefined> {
  return (window as any).__ENV ?? {};
}
