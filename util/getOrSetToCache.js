import { logger } from './logger.js'
import { RedisClient } from './redis.js'

export async function getOrSetToCache(key, callback) {
  const data = await RedisClient.get(key)
  if (data) {
    logger.info(
      {
        type: 'redis',
        status: 'hit',
        key: key,
      },
      'Cache hit'
    )
    return JSON.parse(data)
  }
  const queryResult = await callback()
  if (queryResult) {
    RedisClient.set(key, JSON.stringify(queryResult))
    RedisClient.expire(key, 600)
    logger.info(
      {
        type: 'redis',
        status: 'miss',
        key: key,
      },
      'Cache missed, adding to cache'
    )
    return queryResult
  }
}
