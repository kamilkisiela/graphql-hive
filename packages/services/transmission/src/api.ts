import type { taskRouter } from './tasks.js';

export type { JobSpec } from './lib/trpc.js';

export type TransmissionAPI = typeof taskRouter;
