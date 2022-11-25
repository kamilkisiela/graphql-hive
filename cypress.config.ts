// eslint-disable-next-line import/no-extraneous-dependencies -- cypress SHOULD be a dev dependency
import { defineConfig } from 'cypress';

export default defineConfig({
  video: false, // TODO: can it be useful for CI?
  screenshotOnRunFailure: false, // TODO: can it be useful for CI?
  e2e: {
    // defaults
  },
});
