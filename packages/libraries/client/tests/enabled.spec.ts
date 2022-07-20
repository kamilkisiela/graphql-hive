import { createHive } from '../src/client';

test("should log that it's not enabled", async () => {
  const logger = {
    error: jest.fn(),
    info: jest.fn(),
  };

  const hive = createHive({
    enabled: false,
    debug: true,
    agent: {
      logger,
    },
    token: 'Token',
  });

  const result = await hive
    .info()
    .then(() => 'OK')
    .catch(() => 'ERROR');

  expect(logger.info).toHaveBeenCalledWith(expect.stringContaining(`[hive] is not enabled.`));
  expect(result).toBe('OK');
});

test("should not log that it's not enabled", async () => {
  const logger = {
    error: jest.fn(),
    info: jest.fn(),
  };

  const hive = createHive({
    enabled: false,
    debug: false,
    agent: {
      logger,
    },
    token: 'Token',
  });

  const result = await hive
    .info()
    .then(() => 'OK')
    .catch(() => 'ERROR');

  expect(logger.info).not.toBeCalled();
  expect(result).toBe('OK');
});
