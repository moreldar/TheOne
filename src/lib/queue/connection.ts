import IORedis from "ioredis";

const globalForRedis = globalThis as unknown as { redisConnection?: IORedis };

export function getRedisConnection(): IORedis {
  if (globalForRedis.redisConnection) return globalForRedis.redisConnection;

  const connection = new IORedis(process.env.REDIS_URL ?? "redis://localhost:6379", {
    maxRetriesPerRequest: null, // required by BullMQ
  });

  globalForRedis.redisConnection = connection;
  return connection;
}
