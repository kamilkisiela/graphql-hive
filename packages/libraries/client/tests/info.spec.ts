import { createHive } from '../src/client';

test('should not leak the exception', async () => {
  const logger = {
    error: jest.fn(),
    info: jest.fn(),
  };

  const hive = createHive({
    enabled: true,
    debug: true,
    agent: {
      logger,
    },
    token: 'Token',
    reporting: {
      endpoint: 'http://empty.localhost',
      author: 'jest',
      commit: 'random',
    },
  });

  const result = await hive
    .info()
    .then(() => 'OK')
    .catch(() => 'ERROR');

  expect(logger.error).toHaveBeenCalledWith(
    expect.stringContaining(`[hive][info] Error`)
  );
  expect(result).toBe('OK');
});
