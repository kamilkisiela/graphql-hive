/**
 * The environment as available on the !!!BACKEND!!!
 */
export const env = globalThis['__backend_env'] ?? noop();

/**
 * Next.js is so kind and tries to pre-render our page without the environment information being available... :)
 * Non of our pages can actually be pre-rendered without first running the backend as it requires the runtime environment variables.
 * So we just return a noop. :)
 */
function noop(): any {
  return new Proxy(new String(''), {
    get(obj, prop) {
      if (prop === Symbol.toPrimitive) {
        return () => undefined;
      }
      if (prop in String.prototype) {
        return obj[prop as any];
      }
      return noop();
    },
  });
}
