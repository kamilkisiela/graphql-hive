import { buildSchema, parse } from 'graphql';
import { createHive } from '@graphql-hive/client';
import { fetch } from '@whatwg-node/fetch';

const isFederation = process.env.FEDERATION === '1';
const isSchemaReportingEnabled = process.env.SCHEMA_REPORTING !== '0';
const isUsageReportingEnabled = process.env.USAGE_REPORTING !== '0';

const envName = process.env.STAGING ? 'staging' : process.env.DEV ? 'dev' : 'local';

const schemaReportingEndpoint =
  envName === 'staging'
    ? 'https://app.staging.graphql-hive.com/registry'
    : envName === 'dev'
      ? 'https://app.dev.graphql-hive.com/registry'
      : 'http://localhost:3001/graphql';

const usageReportingEndpoint =
  envName === 'staging'
    ? 'https://app.staging.graphql-hive.com/usage'
    : envName === 'dev'
      ? 'https://app.dev.graphql-hive.com/usage'
      : 'http://localhost:4001';

console.log(`
  Environment:                ${envName}
  Schema reporting endpoint:  ${schemaReportingEndpoint}
  Usage reporting endpoint:   ${usageReportingEndpoint}

  Schema reporting:           ${isSchemaReportingEnabled ? 'enabled' : 'disabled'}
  Usage reporting:            ${isUsageReportingEnabled ? 'enabled' : 'disabled'}
`);

const createInstance = (
  service: null | {
    name: string;
    url: string;
  },
) => {
  return createHive({
    token: process.env.TOKEN!,
    agent: {
      name: 'Hive Seed Script',
      maxSize: 10,
    },
    debug: true,
    enabled: true,
    reporting: isSchemaReportingEnabled
      ? {
          endpoint: schemaReportingEndpoint,
          author: 'Hive Seed Script',
          commit: '1',
          serviceName: service?.name,
          serviceUrl: service?.url,
        }
      : false,
    usage: isUsageReportingEnabled
      ? {
          clientInfo: () => ({
            name: 'Fake Hive Client',
            version: '1.1.1',
          }),
          endpoint: usageReportingEndpoint,
          max: 10,
          sampleRate: 1,
        }
      : false,
  });
};

async function single() {
  const hiveInstance = createInstance(null);

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
        const randNumber = Math.random() * 100;
        console.log('Reporting usage query...');

        const done = hiveInstance.collectUsage();

        done(
          {
            document: randNumber > 50 ? query1 : query2,
            schema,
            variableValues: {},
            contextValue: {},
          },
          randNumber > 90
            ? {
                errors: undefined,
              }
            : {
                errors: [{ message: 'oops' }],
              },
        );
      }
    },
    process.env.INTERVAL ? parseInt(process.env.INTERVAL) : 1000,
  );
}

const publishMutationDocument =
  /* GraphQL */
  `
    mutation schemaPublish($input: SchemaPublishInput!) {
      schemaPublish(input: $input) {
        __typename
        ... on SchemaPublishSuccess {
          initial
          valid
          message
          linkToWebsite
          changes {
            nodes {
              message
              criticality
            }
            total
          }
        }
        ... on SchemaPublishError {
          valid
          linkToWebsite
          changes {
            nodes {
              message
              criticality
            }
            total
          }
          errors {
            nodes {
              message
            }
            total
          }
        }
      }
    }
  `;

async function federation() {
  const instance = createInstance(null);
  const schemaInventory = /* GraphQL */ `
    type Product implements ProductItf @key(fields: "id") {
      id: ID!
      dimensions: ProductDimension @external
      delivery(zip: String): DeliveryEstimates @requires(fields: "dimensions { size weight }")
    }

    type ProductDimension @shareable {
      size: String
      weight: Float
    }

    type DeliveryEstimates {
      estimatedDelivery: String
      fastestDelivery: String
    }

    interface ProductItf {
      id: ID!
      dimensions: ProductDimension
      delivery(zip: String): DeliveryEstimates
    }

    enum ShippingClass {
      STANDARD
      EXPRESS
      OVERNIGHT
    }
  `;

  const schemaPandas = /* GraphQL */ `
    directive @tag(name: String!) repeatable on FIELD_DEFINITION

    type Query {
      allPandas: [Panda]
      panda(name: ID!): Panda
    }

    type Panda {
      name: ID!
      favoriteFood: String @tag(name: "nom-nom-nom")
    }
  `;

  const schemaProducts = /* GraphQL */ `
    directive @myDirective(a: String!) on FIELD_DEFINITION
    directive @hello on FIELD_DEFINITION

    type Query {
      allProducts: [ProductItf]
      product(id: ID!): ProductItf
    }

    interface ProductItf implements SkuItf {
      id: ID!
      sku: String
      name: String
      package: String
      variation: ProductVariation
      dimensions: ProductDimension
      createdBy: User
      hidden: String @inaccessible
      oldField: String @deprecated(reason: "refactored out")
    }

    interface SkuItf {
      sku: String
    }

    type Product implements ProductItf & SkuItf
      @key(fields: "id")
      @key(fields: "sku package")
      @key(fields: "sku variation { id }") {
      id: ID! @tag(name: "hi-from-products")
      sku: String
      name: String @hello
      package: String
      variation: ProductVariation
      dimensions: ProductDimension
      createdBy: User
      hidden: String
      reviewsScore: Float!
      oldField: String
    }
    enum ShippingClass {
      STANDARD
      EXPRESS
    }
    type ProductVariation {
      id: ID!
      name: String
    }
    type ProductDimension @shareable {
      size: String
      weight: Float
    }
    type User @key(fields: "email") {
      email: ID!
      totalProductsCreated: Int @shareable
    }
  `;

  const schemaReviews = /* GraphQL */ `
    type Product implements ProductItf @key(fields: "id") {
      id: ID!
      reviewsCount: Int!
      reviewsScore: Float! @shareable @override(from: "products")
      reviews: [Review!]!
    }

    interface ProductItf {
      id: ID!
      reviewsCount: Int!
      reviewsScore: Float!
      reviews: [Review!]!
    }

    type Query {
      review(id: Int!): Review
    }

    type Review {
      id: Int!
      body: String!
    }
  `;

  const schemaUsers = /* GraphQL */ `
    directive @tag(name: String!) repeatable on FIELD_DEFINITION | OBJECT

    type User @key(fields: "email") {
      email: ID! @tag(name: "test-from-users")
      name: String
      totalProductsCreated: Int
      createdAt: DateTime
    }

    scalar DateTime
  `;

  let res = await fetch(schemaReportingEndpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.TOKEN}`,
    },
    body: JSON.stringify({
      query: publishMutationDocument,
      variables: {
        input: {
          author: 'MoneyBoy',
          commit: '1977',
          sdl: schemaInventory,
          service: 'Inventory',
          url: 'https://inventory.localhost/graphql',
        },
      },
    }),
  }).then(res => res.json());
  console.log(JSON.stringify(res, null, 2));

  res = await fetch(schemaReportingEndpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.TOKEN}`,
    },
    body: JSON.stringify({
      query: publishMutationDocument,
      variables: {
        input: {
          author: 'MoneyBoy',
          commit: '1977',
          sdl: schemaPandas,
          service: 'Panda',
          url: 'https://panda.localhost/graphql',
        },
      },
    }),
  }).then(res => res.json());

  console.log(JSON.stringify(res, null, 2));

  res = await fetch(schemaReportingEndpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.TOKEN}`,
    },
    body: JSON.stringify({
      query: publishMutationDocument,
      variables: {
        input: {
          author: 'MoneyBoy',
          commit: '1977',
          sdl: schemaProducts,
          service: 'Products',
          url: 'https://products.localhost/graphql',
        },
      },
    }),
  }).then(res => res.json());

  console.log(JSON.stringify(res, null, 2));

  res = await fetch(schemaReportingEndpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.TOKEN}`,
    },
    body: JSON.stringify({
      query: publishMutationDocument,
      variables: {
        input: {
          author: 'MoneyBoy',
          commit: '1977',
          sdl: schemaReviews,
          service: 'Reviews',
          url: 'https://reviews.localhost/graphql',
        },
      },
    }),
  }).then(res => res.json());

  console.log(JSON.stringify(res, null, 2));

  res = await fetch(schemaReportingEndpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.TOKEN}`,
    },
    body: JSON.stringify({
      query: publishMutationDocument,
      variables: {
        input: {
          author: 'MoneyBoy',
          commit: '1977',
          sdl: schemaUsers,
          service: 'Users',
          url: 'https://users.localhost/graphql',
        },
      },
    }),
  }).then(res => res.json());

  console.log(JSON.stringify(res, null, 2));

  await instance.info();
}

if (isFederation === false) {
  await single();
} else {
  await federation();
}
