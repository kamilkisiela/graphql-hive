import type { SamplingContext } from './types.js';

export function randomSampling(sampleRate: number) {
  if (sampleRate > 1 || sampleRate < 0) {
    throw new Error(`Expected usage.sampleRate to be 0 <= x <= 1, received ${sampleRate}`);
  }

  return function shouldInclude(): boolean {
    return Math.random() <= sampleRate;
  };
}

export function dynamicSampling(sampler: (context: SamplingContext) => number | boolean) {
  return function shouldInclude(context: SamplingContext): boolean {
    let sampleRate = sampler(context);

    if (sampleRate === true) {
      sampleRate = 1;
    } else if (sampleRate === false) {
      sampleRate = 0;
    }

    if (sampleRate > 1 || sampleRate < 0) {
      throw new Error(`Expected usage.sampleRate to be 0 <= x <= 1, received ${sampleRate}`);
    }

    return Math.random() <= sampleRate;
  };
}
