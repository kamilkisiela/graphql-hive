import type { FastifyInstance } from 'fastify';
import { buildSchema, execute, GraphQLError, parse } from 'graphql';
import { z } from 'zod';
import { env } from '@/env/backend';
import { addMocksToSchema } from '@graphql-tools/mock';

const LabParams = z.object({
  organizationId: z.string({
    required_error: 'Missing organizationId (format /api/lab/:organizationId/:projectId/:targetId)',
  }),
  projectId: z.string({
    required_error: 'Missing projectId (format /api/lab/:organizationId/:projectId/:targetId)',
  }),
  targetId: z.string({
    required_error: 'Missing targetId (format /api/lab/:organizationId/:projectId/:targetId)',
  }),
});

const LabBody = z.object({
  query: z.string({
    required_error: 'Missing query',
  }),
  variables: z.record(z.unknown()).optional(),
});

export function connectLab(server: FastifyInstance) {
  server.all('/api/lab/:organizationId/:projectId/:targetId', async (req, res) => {
    const url = env.graphqlPublicEndpoint;

    const labParamsResult = LabParams.safeParse(req.params);

    if (!labParamsResult.success) {
      void res.status(400).send(labParamsResult.error.flatten().fieldErrors);
      return;
    }

    const { organizationId, projectId, targetId } = labParamsResult.data;

    const headers: Record<string, string> = {};

    if (req.headers['x-hive-key']) {
      headers['Authorization'] = `Bearer ${req.headers['x-hive-key'] as string}`;
    } else {
      headers['Cookie'] = req.headers.cookie as string;
    }

    const body = {
      operationName: 'lab',
      query: /* GraphQL */ `
        query lab($selector: TargetSelectorInput!) {
          lab(selector: $selector) {
            schema
            mocks
          }
        }
      `,
      variables: {
        selector: {
          organization: organizationId,
          project: projectId,
          target: targetId,
        },
      },
    };

    if (req.headers['x-request-id']) {
      headers['x-request-id'] = req.headers['x-request-id'] as string;
    }

    const response = await fetch(url, {
      headers: {
        'content-type': 'application/json',
        'graphql-client-name': 'Hive App',
        'graphql-client-version': env.release,
        ...headers,
      },
      credentials: 'include',
      method: 'POST',
      body: JSON.stringify(body),
    });

    const parsedData = await response.json();

    if (!parsedData.data?.lab?.schema) {
      void res.status(200).send({
        errors: [new GraphQLError('Please publish your first schema to Hive')],
      });

      return;
    }

    if (parsedData.data?.errors?.length > 0) {
      void res.status(200).send(parsedData.data);
      return;
    }

    try {
      const graphqlRequest = LabBody.parse(req.body);

      const rawSchema = buildSchema(parsedData.data.lab?.schema);
      const document = parse(graphqlRequest.query);

      const mockedSchema = addMocksToSchema({
        schema: rawSchema,
        preserveResolvers: false,
      });

      const result = await execute({
        schema: mockedSchema,
        document,
        variableValues: graphqlRequest.variables || {},
        contextValue: {},
      });

      void res.status(200).send(result);
    } catch (e) {
      req.log.error(e);
      void res.status(200).send({
        errors: [e],
      });
    }
  });
}
