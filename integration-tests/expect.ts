import { expect } from 'vitest';

expect.extend({
  /** CHeck whether a string contains a certain substring without caring about whitespace */
  toIncludeSubstringWithoutWhitespace(received: string, expected: string) {
    // regex that removes all whitespace from the expected string
    const receivedCleaned = received.replace(/\s+/g, ' ').trim();
    const expectedCleaned = expected.replace(/\s+/g, ' ').trim();
    return {
      message: () => `expected text to include substring ${receivedCleaned} ${expectedCleaned}`,
      pass: receivedCleaned.includes(expectedCleaned),
    };
  },
});

interface CustomMatchers<R = unknown> {
  toIncludeSubstringWithoutWhitespace(expected: string): R;
}

declare module 'vitest' {
  interface Assertion<T = any> extends CustomMatchers<T> {}
  interface AsymmetricMatchersContaining extends CustomMatchers {}
}
