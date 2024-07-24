import { local } from '@pulumi/command';
import type { GraphQL } from '../services/graphql';

/** Publish API GraphQL schema to Hive schema registry. */
export function publishGraphQLSchema(args: {
  graphql: GraphQL;
  registry: { accessToken: string; endpoint: string };
  version: {
    commit: string;
  };
}) {
  const command =
    ` --registry.endpoint ${args.registry.endpoint} --registry.accessToken ${args.registry.accessToken}` +
    ` schema:publish --commit ${args.version.commit} --author "Hive CD" ./schema.graphql`;

  return new local.Command(
    'publish-graphql-schema',
    {
      create:
        `docker run --name "publish-graphql-schema" ghcr.io/kamilkisiela/graphql-hive/cli:0.36.0 ` +
        command,
    },
    {
      dependsOn: [args.graphql.deployment, args.graphql.service],
    },
  );
}
