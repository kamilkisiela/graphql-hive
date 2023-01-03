import { DefaultServerAdapterContext } from '@whatwg-node/router';
import Toucan from 'toucan-js';

export type ServerContext = DefaultServerAdapterContext & {
  sentry?: Toucan;
};
