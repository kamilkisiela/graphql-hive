/* eslint-disable import/no-extraneous-dependencies */
import Redis from 'ioredis';

export const resetRedis = async (conn: { host: string; port: number; password: string }) => {
  const redis = new Redis({
    host: conn.host,
    port: conn.port,
    password: conn.password,
    db: 0,
    maxRetriesPerRequest: 5,
    enableReadyCheck: true,
  });

  const keys = await redis.keys('*');
  if (keys?.length) {
    await redis.del(keys);
  }
};
