import {
  buildSchema,
  GraphQLError,
  Kind,
  parse,
  Source,
  specifiedRules,
  TypeInfo,
  validate,
} from 'graphql';
import type { DocumentNode, ValidationContext } from 'graphql';
import { collectSchemaCoordinates, preprocessOperation } from '@graphql-hive/core';
import { Args, Flags } from '@oclif/core';
import Command from '../../base-command';
import { graphql } from '../../gql';
import { AppDeploymentStatus } from '../../gql/graphql';
import * as GraphQLSchema from '../../gql/graphql';
import { loadAppOperations } from '../../helpers/app-operations';
import { graphqlEndpoint } from '../../helpers/config';
import {
  APIError,
  InvalidDocumentsErrors,
  InvalidPersistedDocumentsError,
  InvalidTargetError,
  MissingArgumentsError,
  MissingEndpointError,
  MissingRegistryTokenError,
  SchemaNotFoundError,
} from '../../helpers/errors';
import * as TargetInput from '../../helpers/target-input';
import { ActivateAppDeploymentMutation } from './publish';

const FetchLatestVersionSDLQuery = graphql(/* GraphQL */ `
  query CLI_App_Create_FetchLatestVersionSDLQuery($target: TargetReferenceInput) {
    latestValidVersion(target: $target) {
      sdl
    }
  }
`);

export default class AppCreate extends Command<typeof AppCreate> {
  static description = 'create an app deployment';
  static flags = {
    'registry.endpoint': Flags.string({
      description: 'registry endpoint',
    }),
    'registry.accessToken': Flags.string({
      description: 'registry access token',
    }),
    name: Flags.string({
      description: 'app name',
      required: true,
    }),
    version: Flags.string({
      description: 'app version',
    }),
    target: Flags.string({
      description:
        'The target in which the app deployment will be created.' +
        ' This can either be a slug following the format "$organizationSlug/$projectSlug/$targetSlug" (e.g "the-guild/graphql-hive/staging")' +
        ' or an UUID (e.g. "a0f4c605-6541-4350-8cfe-b31f21a4bf80").',
    }),
    publish: Flags.boolean({
      description: 'Publish the app deployment after creation.',
      default: false,
    }),
  };

  static args = {
    operations: Args.string({
      name: 'operations',
      required: true,
      description:
        'Path to the persisted operations manifest (GraphQL Code Generator, Relay or Apollo persisted query manifest JSON file), a directory containing .graphql files, or a glob pattern matching .graphql files.',
      hidden: false,
    }),
  };

  async run() {
    const { flags, args } = await this.parse(AppCreate);

    let endpoint: string, accessToken: string;
    try {
      endpoint = this.ensure({
        key: 'registry.endpoint',
        args: flags,
        defaultValue: graphqlEndpoint,
        env: 'HIVE_REGISTRY',
        description: AppCreate.flags['registry.endpoint'].description!,
      });
    } catch (e) {
      throw e instanceof MissingArgumentsError ? new MissingEndpointError() : e;
    }

    try {
      accessToken = this.ensure({
        key: 'registry.accessToken',
        args: flags,
        env: 'HIVE_TOKEN',
        description: AppCreate.flags['registry.accessToken'].description!,
      });
    } catch (e) {
      throw e instanceof MissingArgumentsError ? new MissingRegistryTokenError() : e;
    }

    let target: GraphQLSchema.TargetReferenceInput | null = null;
    if (flags.target) {
      const result = TargetInput.parse(flags.target);
      if (result.type === 'error') {
        throw new InvalidTargetError();
      }
      target = result.data;
    }

    const version = flags.version ?? Math.random().toString(36).padEnd(9, '0').slice(2, 9);
    if (!flags.version) {
      this.log(`No version provided, using generated version: ${version}`);
    }

    const { manifest, operations, generatedFrom, warnings } = await loadAppOperations(
      args.operations,
    );
    for (const warning of warnings) {
      this.warn(warning);
    }
    if (generatedFrom) {
      this.log(
        `Persisted documents manifest generated in-memory from discovered GraphQL operations under "${generatedFrom}".`,
      );
      this.log(JSON.stringify(manifest, null, 2));
    }

    const schemaResult = await this.registryApi(endpoint, accessToken).request({
      operation: FetchLatestVersionSDLQuery,
      variables: { target },
    });

    if (!schemaResult.latestValidVersion?.sdl) {
      throw new SchemaNotFoundError();
    }

    const schema = buildSchema(schemaResult.latestValidVersion.sdl, {
      assumeValidSDL: true,
      assumeValid: true,
    });
    const typeInfo = new TypeInfo(schema);
    const processedDocuments: {
      hash: string;
      body: string;
      operationName: string | null;
      schemaCoordinates: string[];
      insightsHash: string;
    }[] = [];
    const allErrors: InvalidDocumentsErrors = [];

    for (const [index, operation] of operations.entries()) {
      let document: DocumentNode | null = null;
      try {
        document = parse(operation.content);
      } catch (error) {
        allErrors.push({
          source: new Source(operation.content, operation.operationHash),
          errors: [error instanceof GraphQLError ? error : new GraphQLError(String(error))],
        });
      }

      if (!document) {
        continue;
      }

      const errors = validate(schema, document, [...specifiedRules, SingleOperationDefinitionRule]);
      if (errors.length > 0) {
        allErrors.push({
          source: new Source(operation.content, operation.operationHash),
          errors,
        });
        continue;
      }

      const operationName = getOperationName(document);
      const schemaCoordinates = collectSchemaCoordinates({
        documentNode: document,
        processVariables: false,
        variables: null,
        schema,
        typeInfo,
      });
      const processed = preprocessOperation({ document, operationName, schemaCoordinates });

      if (!processed) {
        allErrors.push({
          source: new Source(operation.content, operation.operationHash),
          errors: [
            new GraphQLError(`Document at index ${index} has no executable operation definition.`),
          ],
        });
        continue;
      }

      processedDocuments.push({
        hash: operation.operationHash,
        body: operation.content,
        operationName,
        schemaCoordinates: Array.from(schemaCoordinates),
        insightsHash: processed.hash,
      });
    }

    if (allErrors.length) {
      throw new InvalidPersistedDocumentsError(allErrors);
    }

    const result = await this.registryApi(endpoint, accessToken).request({
      operation: CreateAppDeploymentMutation,
      variables: {
        input: {
          appName: flags['name'],
          appVersion: version,
          target,
        },
      },
    });

    if (result.createAppDeployment.error) {
      const { message, details } = result.createAppDeployment.error;
      const reasons = [
        details?.appName ? `--name: ${details.appName}` : null,
        details?.appVersion ? `--version: ${details.appVersion}` : null,
      ].filter(Boolean);
      throw new APIError(reasons.length ? `${message}\n${reasons.join('\n')}` : message);
    }

    if (!result.createAppDeployment.ok) {
      throw new APIError(`Create App failed without providing a reason.`);
    }

    if (result.createAppDeployment.ok.createdAppDeployment.status !== AppDeploymentStatus.Pending) {
      this.log(
        `App deployment "${flags['name']}@${version}" is "${result.createAppDeployment.ok.createdAppDeployment.status}". Skip uploading documents...`,
      );
      return;
    }

    const totalDocuments = Object.keys(manifest).length;

    this.log(
      `App deployment "${flags['name']}@${version}" is created pending document upload. Uploading documents...`,
    );

    let buffer: typeof processedDocuments = [];

    let counter = 0;

    const flush = async (force = false) => {
      if (buffer.length >= 100 || (force && buffer.length > 0)) {
        const result = await this.registryApi(endpoint, accessToken).request({
          operation: AddDocumentsToAppDeploymentMutation,
          timeout: 55_000,
          retry: { retries: 2 },
          variables: {
            input: {
              target,
              appName: flags['name'],
              appVersion: version,
              documents: buffer,
            },
          },
        });

        if (result.addPreprocessedDocumentsToAppDeployment.error) {
          if (result.addPreprocessedDocumentsToAppDeployment.error.details) {
            const affectedOperation =
              buffer[result.addPreprocessedDocumentsToAppDeployment.error.details.index];

            const maxCharacters = 40;

            if (affectedOperation) {
              const truncatedBody = (
                affectedOperation.body.length > maxCharacters - 3
                  ? affectedOperation.body.substring(0, maxCharacters) + '...'
                  : affectedOperation.body
              ).replace(/\n/g, '\\n');
              this.logWarning(
                `Failed uploading document: ${result.addPreprocessedDocumentsToAppDeployment.error.details.message}` +
                  `\nOperation hash: ${affectedOperation?.hash}` +
                  `\nOperation body: ${truncatedBody}`,
              );
            }
          }
          throw new APIError(result.addPreprocessedDocumentsToAppDeployment.error.message);
        }
        buffer = [];

        // don't bother showing 100% since there's another log line when it's done. And for deployments with just a few docs, showing this progress is unnecessary.
        if (counter !== totalDocuments) {
          this.log(
            `${counter} / ${totalDocuments} (${Math.round((100.0 * counter) / totalDocuments)}%) documents uploaded...`,
          );
        }
      }
    };

    for (const document of processedDocuments) {
      buffer.push(document);
      counter++;
      await flush();
    }

    await flush(true);

    this.log(`\nApp deployment "${flags['name']}@${version}" (${counter} operations) created.`);
    if (!flags.publish) {
      this.log(`Activate it with the "hive app:publish" command.`);
      return;
    }

    this.log('Publishing app deployment...');
    const publishResult = await this.registryApi(endpoint, accessToken).request({
      operation: ActivateAppDeploymentMutation,
      variables: {
        input: {
          target,
          appName: flags['name'],
          appVersion: version,
        },
      },
    });

    if (publishResult.activateAppDeployment.error) {
      throw new APIError(publishResult.activateAppDeployment.error.message);
    }

    if (publishResult.activateAppDeployment.ok) {
      const deploymentName = `${publishResult.activateAppDeployment.ok.activatedAppDeployment.name}@${publishResult.activateAppDeployment.ok.activatedAppDeployment.version}`;
      if (publishResult.activateAppDeployment.ok.isSkipped) {
        this.warn(`\nApp deployment "${deploymentName}" is already published. Skipping...`);
      } else {
        this.log('\nApp deployment published successfully.');
      }
    }
  }
}

const CreateAppDeploymentMutation = graphql(/* GraphQL */ `
  mutation CreateAppDeployment($input: CreateAppDeploymentInput!) {
    createAppDeployment(input: $input) {
      ok {
        createdAppDeployment {
          id
          name
          version
          status
        }
      }
      error {
        message
        details {
          appName
          appVersion
        }
      }
    }
  }
`);

const AddDocumentsToAppDeploymentMutation = graphql(/* GraphQL */ `
  mutation AddDocumentsToAppDeployment($input: AddPreprocessedDocumentsToAppDeploymentInput!) {
    addPreprocessedDocumentsToAppDeployment(input: $input) {
      ok {
        appDeployment {
          id
          name
          version
          status
        }
      }
      error {
        message
        details {
          index
          message
          __typename
        }
      }
    }
  }
`);

function SingleOperationDefinitionRule(context: ValidationContext) {
  return {
    Document(node: DocumentNode) {
      const operations = node.definitions.filter(
        definition => definition.kind === Kind.OPERATION_DEFINITION,
      );
      if (operations.length > 1) {
        context.reportError(
          new GraphQLError(
            'Multiple operation definitions found. Only one executable operation definition is allowed per document.',
            { nodes: operations },
          ),
        );
      }
    },
  };
}

function getOperationName(document: DocumentNode): string | null {
  for (const definition of document.definitions) {
    if (definition.kind === Kind.OPERATION_DEFINITION) {
      return definition.name?.value ?? null;
    }
  }
  return null;
}
