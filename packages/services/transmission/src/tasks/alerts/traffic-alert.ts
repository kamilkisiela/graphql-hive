// import { z } from 'zod';
// import { chSql } from '@hive/api';
// import { addJob } from '../tasks';
// import { createTask, JobHelpers } from '../utils';

// type Action =
//   | {
//       kind: 'email';
//       email: string;
//     }
//   | {
//       kind: 'slack';
//       channel: string;
//     }
//   | {
//       kind: 'teams';
//       url: string;
//     }
//   | {
//       kind: 'webhook';
//       url: string;
//     };

// type TrafficAlert = {
//   id: string;
//   scheduleId: string;
//   status: 'resolved' | 'triggered';
//   projectId: string;
//   targets: string[];
//   excludedClients: string[];
//   conditions: {
//     timeWindowInMs: number;
//   } & (
//     | {
//         sign: '+' | '-';
//         thresholdPercentage: number;
//       }
//     | {
//         sign: '>' | '<' | '<=' | '>=';
//         thresholdStatic: number;
//       }
//   );
//   actions: Array<Action>;
// };

// type OperationsFilter = {
//   targets: string[];
//   excludedClients: string[];
//   timeWindowInMs: number;
// };

// type TrafficAlertMetCondition =
//   | {
//       sign: '+' | '-';
//       thresholdPercentage: number;
//     }
//   | {
//       sign: '>' | '<' | '<=' | '>=';
//       thresholdStatic: number;
//     };

// async function fetchTrafficAlert(helpers: JobHelpers, alertId: string): Promise<TrafficAlert> {
//   helpers.logger.debug('Fetching alert configuration');
//   return {
//     id: alertId,
//     scheduleId: '123',
//     status: 'resolved',
//     projectId: '456',
//     targets: ['789'],
//     excludedClients: [],
//     conditions: {
//       timeWindowInMs: 60_000,
//       sign: '+',
//       thresholdPercentage: 10,
//     },
//     actions: [
//       {
//         kind: 'email',
//         email: 'kamil@the-guild.dev',
//       },
//       {
//         kind: 'slack',
//         channel: 'feed',
//       },
//     ],
//   };
// }

// async function fetchTrafficData(
//   helpers: JobHelpers,
//   filter: OperationsFilter,
// ): Promise<{
//   previously: number;
//   currently: number;
// }> {
//   helpers.logger.debug('Fetching traffic data');

//   const completeTimeWindowInMs = filter.timeWindowInMs * 2;
//   const completeTimeWindowInHours = completeTimeWindowInMs / 1000 / 60 / 60;
//   const tableName = completeTimeWindowInHours > 24 ? 'operations_hourly' : 'minutely';

//   const timeWindowInMinutes = Math.ceil(filter.timeWindowInMs / 1000 / 60);

//   const intervalText = `interval ${timeWindowInMinutes} minutes`;
//   const doubleIntervalText = `interval ${timeWindowInMinutes * 2} minutes`;

//   // TODO: support hourly aggregation (interval should be different)
//   // TODO: pause notifications if usage reporting is not available or downgraded

//   const result = await helpers.context.clickhouse.query<{
//     period: 'currently' | 'previously';
//     total: string;
//   }>({
//     query: chSql`
//       SELECT 'currently' AS period, sum(total) AS total
//       FROM ${chSql.raw(tableName)}
//       WHERE
//         target_id IN (${chSql.array(filter.targets, 'String')})
//         AND
//         timestamp >= now() - interval 1 minute - ${chSql.raw(intervalText)}
//         AND
//         timestamp < now() - interval 1 minute

//       UNION ALL

//       SELECT 'previously' AS period, sum(total) AS total
//       FROM ${chSql.raw(tableName)}
//       WHERE
//         target_id IN (${chSql.array(filter.targets, 'String')})
//         AND
//         timestamp >= now() - interval 1 minute - ${chSql.raw(doubleIntervalText)}
//         AND
//         timestamp < now() - interval 1 minute - ${chSql.raw(intervalText)}
//     `,
//     timeout: 15_000,
//     queryId: 'fetchTrafficData',
//   });

//   // filter.timeWindowInMs

//   const previously = result.data.find(d => d.period === 'previously')?.total;
//   const currently = result.data.find(d => d.period === 'currently')?.total;

//   if (previously === undefined || currently === undefined) {
//     throw new Error('Missing data');
//   }

//   return {
//     previously: parseInt(previously, 10),
//     currently: parseInt(currently, 10),
//   };
// }

// async function updateTrafficAlert(
//   helpers: JobHelpers,
//   alert: TrafficAlert,
//   data: { status: 'resolved' | 'triggered'; traffic: { previously: number; currently: number } },
// ): Promise<void> {
//   helpers.logger.info(`Updating traffic alert (status=${data.status}, was=${alert.status}`, {
//     previously: data.traffic.previously,
//     currently: data.traffic.currently,
//     sign: alert.conditions.sign,
//     threshold:
//       'thresholdPercentage' in alert.conditions
//         ? alert.conditions.thresholdPercentage
//         : alert.conditions.thresholdStatic,
//   });
// }

// function checkConditions(
//   conditions: TrafficAlertMetCondition,
//   traffic: { previously: number; currently: number },
// ) {
//   const { previously, currently } = traffic;

//   if ('thresholdPercentage' in conditions) {
//     const threshold = previously * (conditions.thresholdPercentage / 100);
//     return conditions.sign === '+'
//       ? // increased by
//         currently >= previously + threshold
//       : // decreased by
//         currently <= previously - threshold;
//   } else {
//     const threshold = conditions.thresholdStatic;

//     switch (conditions.sign) {
//       case '>':
//         return currently > threshold;
//       case '>=':
//         return currently >= threshold;
//       case '<=':
//         return currently <= threshold;
//       case '<':
//         return currently < threshold;
//       default:
//         // @ts-expect-error
//         throw new Error('Invalid sign, got: ' + conditions?.sign);
//     }
//   }
// }

// export function createTrafficAlertTask() {
//   return createTask(
//     z.object({
//       alertId: z.string(),
//     }),
//     async function trafficAlertTask({ alertId }, helpers) {
//       helpers.logger.debug('Starting traffic alert task');
//       const alert = await fetchTrafficAlert(helpers, alertId);

//       const traffic = await fetchTrafficData(helpers, {
//         targets: alert.targets,
//         excludedClients: alert.excludedClients,
//         timeWindowInMs: alert.conditions.timeWindowInMs,
//       });

//       const thresholdExceeded = checkConditions(alert.conditions, traffic);

//       /**
//        * | status    | thresholdExceeded | action    |
//        * |-----------|-------------------|-----------|
//        * | resolved  | true              | triggered | starts an alert
//        * | resolved  | false             | unchanged |
//        * | triggered | true              | unchanged |
//        * | triggered | false             | resolved  | ends an alert
//        */
//       let status: 'triggered' | 'resolved' | 'unchanged' = 'unchanged';

//       // Yes, I could do it as one if statement etc etc, but to me this is more readable.
//       // No ESLint, go away.
//       if (thresholdExceeded) {
//         if (alert.status === 'triggered') {
//           // no action needed, user is already alerted
//           helpers.logger.debug('Alert was already triggered. No action needed');
//           return;
//         }
//         status = 'triggered';
//       } else {
//         if (alert.status === 'resolved') {
//           // no action needed, all normal
//           helpers.logger.debug('Alert was already resolved. No action needed');
//           return;
//         }
//         status = 'resolved';
//       }

//       await updateTrafficAlert(helpers, alert, {
//         status: status,
//         traffic,
//       });

//       helpers.logger.debug('Scheduling notifications');

//       await Promise.all(
//         alert.actions.map(action => {
//           switch (action.kind) {
//             case 'email':
//               return addJob(
//                 helpers,
//                 'sendEmail',
//                 {
//                   to: action.email,
//                   subject: `Traffic alert for ${alert.projectId}`,
//                   body: `Traffic alert for ${alert.projectId} has been ${status === 'resolved' ? 'resolved' : 'triggered'}. Traffic previously: ${traffic.previously}, currently: ${traffic.currently}`,
//                 },
//                 { maxAttempts: 5, jobKey: alertId + '-email', jobKeyMode: 'replace' },
//               );
//             case 'slack':
//               return addJob(
//                 helpers,
//                 'sendSlackMessage',
//                 {
//                   channel: action.channel,
//                   message: `Traffic alert for ${alert.projectId} has been ${status === 'resolved' ? 'resolved' : 'triggered'}. Traffic before: ${traffic.previously}, after: ${traffic.currently}`,
//                 },
//                 {
//                   maxAttempts: 5,
//                   jobKey: alertId + '-slack',
//                   jobKeyMode: 'replace',
//                 },
//               );
//             case 'teams':
//               return addJob(
//                 helpers,
//                 'sendMSTeamsWebhook',
//                 {
//                   url: action.url,
//                   body: `Traffic alert for ${alert.projectId} has been ${status === 'resolved' ? 'resolved' : 'triggered'}. Traffic before: ${traffic.previously}, after: ${traffic.currently}`,
//                 },
//                 {
//                   maxAttempts: 5,
//                   jobKey: alertId + '-msteams',
//                   jobKeyMode: 'replace',
//                 },
//               );
//             case 'webhook':
//               return addJob(
//                 helpers,
//                 'sendWebhook',
//                 {
//                   url: action.url,
//                   body: `Traffic alert for ${alert.projectId} has been ${status === 'resolved' ? 'resolved' : 'triggered'}. Traffic before: ${traffic.previously}, after: ${traffic.currently}`,
//                 },
//                 {
//                   maxAttempts: 5,
//                   jobKey: alertId + '-webhook',
//                   jobKeyMode: 'replace',
//                 },
//               );
//           }
//         }),
//       );

//       helpers.logger.debug('Scheduled notifications');
//     },
//   );
// }
