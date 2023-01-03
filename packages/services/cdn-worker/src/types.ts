import Toucan from 'toucan-js';

export type ServerContext = FetchEvent & {
  sentry?: Toucan;
};
