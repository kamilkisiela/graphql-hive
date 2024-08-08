import type { taskRouter } from './tasks';

export type { JobSpec } from './trpc';

export type TransmissionAPI = typeof taskRouter;
