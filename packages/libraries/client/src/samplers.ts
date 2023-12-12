import { dynamicSampling } from './internal/sampling.js';
import type { SamplingContext } from './internal/types.js';

/**
 * Every operation is reported at least once, but every next occurrence is decided by the sampler.
 */
export function atLeastOnceSampler(config: {
  /**
   * Produces a unique key for a given GraphQL request.
   * This key is used to determine the uniqueness of a GraphQL operation.
   */
  keyFn(context: SamplingContext): string;
  sampler(context: SamplingContext): number | boolean;
}) {
  const sampler = dynamicSampling(config.sampler);
  const reportedKeys = new Set<string>();

  return function shouldInclude(context: SamplingContext): boolean {
    const key = config.keyFn(context);

    if (!reportedKeys.has(key)) {
      reportedKeys.add(key);
      return true;
    }

    return sampler(context);
  };
}
