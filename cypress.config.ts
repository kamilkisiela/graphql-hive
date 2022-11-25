// cypress SHOULD be a dev dependency
// eslint-disable-next-line import/no-extraneous-dependencies
import { defineConfig } from 'cypress';

export default defineConfig({
  video: false, // TODO: can it be useful for CI?
  screenshotOnRunFailure: false, // TODO: can it be useful for CI?
  e2e: {
    // defaults
  },
});
