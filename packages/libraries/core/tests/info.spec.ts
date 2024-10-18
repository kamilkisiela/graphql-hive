import nock from 'nock';
import { createHive } from '../src/client/client';

test('should not leak the exception', async () => {
  const logger = {
    error: vi.fn(),
    info: vi.fn(),
  };

  const hive = createHive({
    enabled: true,
    debug: true,
    agent: { logger },
    token: 'Token',
    reporting: {
      endpoint: 'http://empty.localhost',
      author: 'jest',
      commit: 'random',
    },
  });

  const result = await Promise.resolve(hive.info())
    .then(() => 'OK')
    .catch(() => 'ERROR');

  expect(logger.error).toHaveBeenCalledWith(expect.stringContaining(`[hive][info] Error`));
  expect(result).toBe('OK');
});

test('should use selfHosting.graphqlEndpoint if provided', async () => {
  const logger = {
    error: vi.fn(),
    info: vi.fn(),
  };

  nock('http://localhost')
    .post('/graphql')
    .once()
    .reply(200, {
      data: {
        tokenInfo: {
          __typename: 'TokenInfo',
          token: {
            name: 'My Token',
          },
          organization: {
            name: 'Org',
            slug: 'org-id',
          },
          project: {
            name: 'Project',
            type: 'SINGLE',
            slug: 'project-id',
          },
          target: {
            name: 'Target',
            slug: 'target-id',
          },
          canReportSchema: true,
          canCollectUsage: true,
          canReadOperations: false,
        },
      },
    });

  const hive = createHive({
    enabled: true,
    debug: true,
    agent: {
      logger,
    },
    token: 'Token',
    selfHosting: {
      graphqlEndpoint: 'http://localhost/graphql',
      applicationUrl: 'http://localhost/',
    },
  });

  const result = await Promise.resolve(hive.info())
    .then(() => 'OK')
    .catch(() => 'ERROR');

  expect(logger.info).toHaveBeenCalledWith(expect.stringContaining(`[hive][info] Token details`));
  expect(logger.info).toHaveBeenCalledWith(expect.stringMatching(/Token name: \s+ My Token/));
  expect(logger.info).toHaveBeenCalledWith(
    expect.stringMatching(/Organization: \s+ Org \s+ http:\/\/localhost\/org-id/),
  );
  expect(logger.info).toHaveBeenCalledWith(
    expect.stringMatching(/Project: \s+ Project \s+ http:\/\/localhost\/org-id\/project-id/),
  );
  expect(logger.info).toHaveBeenCalledWith(
    expect.stringMatching(
      /Target: \s+ Target \s+ http:\/\/localhost\/org-id\/project-id\/target-id/,
    ),
  );
  expect(logger.info).toHaveBeenCalledWith(expect.stringMatching(/Can report schema\? \s+ Yes/));
  expect(logger.info).toHaveBeenCalledWith(expect.stringMatching(/Can collect usage\? \s+ Yes/));
  expect(logger.info).toHaveBeenCalledWith(expect.stringMatching(/Can read operations\? \s+ No/));
  expect(result).toBe('OK');
});
