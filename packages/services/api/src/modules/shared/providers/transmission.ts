import { CONTEXT, Inject, Injectable, InjectionToken, Scope } from 'graphql-modules';
import type { TaskClient, TransmissionAPI } from '@hive/transmission';
import { createTRPCProxyClient, httpLink } from '@trpc/client';

export const TRANSMISSION_ENDPOINT = new InjectionToken<string>('TRANSMISSION_ENDPOINT');
export const TRANSMISSION_TASK_CLIENT = new InjectionToken<TaskClient>('TRANSMISSION_TASK_CLIENT');

type TaskName = Parameters<TaskClient['addJob']>['0'];
type Payload = Parameters<TaskClient['addJob']>['1'];
type Spec = Parameters<TaskClient['addJob']>['2'];

@Injectable({
  scope: Scope.Operation,
})
export class Transmission {
  public client;

  constructor(
    @Inject(TRANSMISSION_ENDPOINT) endpoint: string,
    @Inject(TRANSMISSION_TASK_CLIENT) private task: TaskClient,
    @Inject(CONTEXT) private context: GraphQLModules.ModuleContext,
  ) {
    this.client = createTRPCProxyClient<TransmissionAPI>({
      links: [
        httpLink({
          url: `${endpoint}/trpc`,
          fetch,
          headers: {
            'x-request-id': context.requestId,
          },
        }),
      ],
    });

    this.task = task;
  }

  async addJob(taskName: TaskName, payload: Payload, spec: Spec) {
    return this.task.addJob(taskName, payload, {
      ...spec,
      requestId: this.context.requestId,
    });
  }
}
