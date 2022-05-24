export function randomSampling(sampleRate: number) {
  if (sampleRate > 1 || sampleRate < 0) {
    throw new Error(`Expected usage.sampleRate to be 0 <= x <= 1, received ${sampleRate}`);
  }

  return function shouldInclude(): boolean {
    return Math.random() <= sampleRate;
  };
}
