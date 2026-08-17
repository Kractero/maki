import { logger } from './logger.js'
import { RedisClient } from './redis.js'

export async function getOrSetToCache(key, callback, expiry) {
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
    if (expiry) {
      await RedisClient.set(key, JSON.stringify(queryResult), 'EX', expiry)
    } else {
      await RedisClient.set(key, JSON.stringify(queryResult))
    }
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
