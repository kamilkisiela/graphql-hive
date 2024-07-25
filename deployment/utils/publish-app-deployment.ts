import { local } from '@pulumi/command';
import { ResourceOptions } from '@pulumi/pulumi';

const dockerImage =
  'ghcr.io/kamilkisiela/graphql-hive/cli:0.40.0-alpha-20240725065155-e240576ec49b275715015567ce1f9c4a77a51f89';

/** Publish API GraphQL schema to Hive schema registry. */
export function publishAppDeployment(args: {
  appName: string;
  registry: { accessToken: string; endpoint: string };
  version: {
    commit: string;
  };
  persistedDocumentsPath: string;
  dependsOn?: ResourceOptions['dependsOn'];
}) {
  // Step 1: Create app deployment
  const createCommand = new local.Command(
    `create-app-deployment-${args.appName}`,
    {
      create:
        `docker run --name "create-app-deployment-${args.appName}"` +
        ` --rm -v ${args.persistedDocumentsPath}:/usr/src/app/persisted-documents.json` +
        ` ${dockerImage}` +
        ` app:create` +
        ` --registry.endpoint ${args.registry.endpoint} --registry.accessToken ${args.registry.accessToken}` +
        ` --name ${args.appName} --version ${args.version.commit} ./persisted-documents.json`,
    },
    {
      dependsOn: args.dependsOn,
    },
  );

  // Step 2: Publish app deployment
  return new local.Command(
    `publish-app-deployment-${args.appName}`,
    {
      create:
        `docker run --rm --name "publish-app-deployment-${args.appName}"` +
        ` ${dockerImage}` +
        ` app:publish` +
        ` --registry.endpoint ${args.registry.endpoint} --registry.accessToken ${args.registry.accessToken}` +
        ` --name ${args.appName} --version ${args.version.commit}`,
    },
    {
      dependsOn: createCommand,
    },
  );
}
