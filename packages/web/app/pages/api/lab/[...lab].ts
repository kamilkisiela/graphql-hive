import { NextApiRequest, NextApiResponse } from 'next';
import { buildSchema, execute, GraphQLError, parse } from 'graphql';
import { env } from '@/env/backend';
import { getLogger } from '@/server-logger';
import { addMocksToSchema } from '@graphql-tools/mock';

// TODO: check if lab is working
async function lab(req: NextApiRequest, res: NextApiResponse) {
  const logger = getLogger(req);
  const url = env.graphqlPublicEndpoint;
  const labParams = req.query.lab || [];

  if (labParams.length < 3) {
    res.status(400).json({
      error: 'Missing Lab Params',
    });
    return;
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [organization, project, target, mock] = labParams as string[];
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
        organization,
        project,
        target,
      },
    },
  };

  if (req['headers']['x-request-id']) {
    headers['x-request-id'] = req['headers']['x-request-id'] as string;
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
    res.status(200).json({
      errors: [new GraphQLError('Please publish your first schema to Hive')],
    });

    return;
  }

  if (parsedData.data?.errors?.length > 0) {
    res.status(200).json(parsedData.data);
  }

  try {
    const rawSchema = buildSchema(parsedData.data.lab?.schema);
    const document = parse(req.body.query);

    const mockedSchema = addMocksToSchema({
      schema: rawSchema,
      preserveResolvers: false,
    });

    const result = await execute({
      schema: mockedSchema,
      document,
      variableValues: req.body.variables || {},
      contextValue: {},
    });

    res.status(200).json(result);
  } catch (e) {
    logger.error(e);
    res.status(200).json({
      errors: [e],
    });
  }
}

export default lab;
