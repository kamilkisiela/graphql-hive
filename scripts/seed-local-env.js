import { createHive } from '@graphql-hive/client';
import { buildSchema, parse } from 'graphql';

async function main() {
  const hiveInstance = createHive({
    token: process.env.TOKEN,
    agent: 'Hive Seed Script',
    debug: true,
    enabled: true,
    reporting: {
      enabled: true,
      endpoint: process.env.STAGING
        ? 'https://app.staging.graphql-hive.com/registry'
        : 'http://localhost:4000/graphql',
      author: 'Hive Seed Script',
      commit: '1',
    },
    usage: {
      enabled: true,
      clientInfo: 'Fake Hive Client',
      endpoint: process.env.STAGING
        ? 'https://app.staging.graphql-hive.com/usage'
        : 'http://localhost:4001',
      max: 10,
      sampleRate: 1,
    },
  });

  await hiveInstance.info();

  const schema = buildSchema(/* GraphQL */ `
    type Query {
      field(arg: String): String
      nested: NestedQuery!
    }

    type NestedQuery {
      test: String
    }
  `);

  const query1 = parse(/* GraphQL */ `
    query test {
      field
      withArg: field(arg: "test")
      nested {
        test
      }
    }
  `);

  const query2 = parse(/* GraphQL */ `
    query testAnother {
      field
    }
  `);

  hiveInstance.reportSchema({ schema });

  const operationsPerBatch = process.env.OPERATIONS ? parseInt(process.env.OPERATIONS) : 1;

  setInterval(
    () => {
      for (let i = 0; i < operationsPerBatch; i++) {
        let randNumber = Math.random() * 100;
        console.log(`Reporting usage query...`);

        const done = hiveInstance.collectUsage({
          document: randNumber > 50 ? query1 : query2,
          schema,
          variableValues: {},
        });

        done(
          randNumber > 90
            ? {
                data: {},
                errors: undefined,
              }
            : {
                data: undefined,
                errors: [{ message: 'oops' }],
              },
        );
      }
    },
    process.env.INTERVAL ? parseInt(process.env.INTERVAL) : 1000,
  );
}

main().catch(console.error);
