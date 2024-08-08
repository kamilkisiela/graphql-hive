// import { addJob } from '../tasks';
// import { createTask } from '../utils';

// /**
//  * This task is responsible for creating alerts related tasks, every minute.
//  */
// export function createAlertsCronTask() {
//   return createTask(null, async function alertsCronTask(_, helpers) {
//     helpers.logger.debug('Running alerts cron task', {
//       attempts: helpers.job.attempts,
//     });
//     // pull alerts from PG
//     // const alertsQuery = await helpers.query<{
//     //   id: string;
//     //   type: 'traffic';
//     // }>('SELECT id, type FROM alerts WHERE deleted_at IS NULL');
//     const alertsQuery = {
//       rows: [
//         {
//           id: 't1',
//           type: 'traffic',
//         },
//         // {
//         //   id: 't2',
//         //   type: 'traffic',
//         // },
//         // {
//         //   id: 't3',
//         //   type: 'traffic',
//         // },
//         // {
//         //   id: 't4',
//         //   type: 'traffic',
//         // },
//       ],
//     } as const;

//     // group by alert type
//     const alertsByType: ['traffic', string[]][] = [];

//     for (const alert of alertsQuery.rows) {
//       const alertsOfType = alertsByType.find(([type]) => type === alert.type);

//       if (alertsOfType) {
//         alertsOfType[1].push(alert.id);
//       } else {
//         alertsByType.push([alert.type, [alert.id]]);
//       }
//     }

//     const childJobs: Promise<unknown>[] = [];
//     for (const [type, alertIds] of alertsByType) {
//       for (const alertId of alertIds) {
//         childJobs.push(addJob(helpers, `${type}AlertTask`, { alertId }, { maxAttempts: 3 }));
//       }
//     }

//     await Promise.all(childJobs);
//   });
// }
