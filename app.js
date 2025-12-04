import Database from 'better-sqlite3'
import express from 'express'
import { join } from 'path'
import { parse } from './util/parse.js'
import { fileURLToPath } from 'url'
import { dirname } from 'path'
import { convertTime } from './util/convertTime.js'
import { rateLimit } from 'express-rate-limit'
import compression from 'compression'
import helmet from 'helmet'
import cors from 'cors'
import { getOrSetToCache } from './util/getOrSetToCache.js'
import { logger } from './util/logger.js'
import 'dotenv/config.js'
import { minutes } from './util/timeSinceUpdate.js'
import { statSync } from 'fs'
import { RedisClient } from './util/redis.js'

const port = process.env.PORT || 3000

const db = new Database('trades.db')
db.pragma('journal_mode = DELETE')

const app = express()
app.set('trust proxy', 1)

const limiter = rateLimit({
  windowMs: 30 * 1000,
  max: 50,
  message: { error: 'Rate limit exceeded', status: 429 },
})

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

app.use(compression())
app.use(helmet())
app.use(cors())
app.use(express.static(join(__dirname + '/public')))
app.use(express.json())

const validParameters = [
  'buyer',
  'seller',
  'cardid',
  'category',
  'minprice',
  'maxprice',
  'price',
  'season',
  'beforetime',
  'sincetime',
]

app.get('/api/tradestotal', limiter, async (req, res) => {
  try {
    const origin = req.headers['x-origin']
    const queryParameters = req.query
    if (queryParameters.hasOwnProperty('category') && queryParameters['category'].toLowerCase() === 'all') {
      delete queryParameters['category']
    }
    const page = queryParameters.page ? parseInt(queryParameters.page) + 1 : 1
    const sqlQuery = parse(queryParameters, 50, page, 'count')
    const newestRecord = db.prepare('SELECT * FROM records ORDER BY last_updated DESC LIMIT 1;').get()
    let tot =
      Object.keys(req.query).filter(key => validParameters.includes(key)).length > 0
        ? await getOrSetToCache(
            `/tradestotal?${sqlQuery[1]}`.toLowerCase(),
            () => db.prepare(sqlQuery[2]).get(...sqlQuery[1]).total_count
          )
        : newestRecord.records
    if (Array.isArray(tot)) tot = tot[0] ? tot[0].total_count : 0
    logger.info(
      {
        type: 'api',
        route: 'tradestotal',
        page: page,
        query: req.query,
        origin: origin === 'frontend' ? 'frontend' : 'api',
      },
      'Trades Total Hit'
    )
    res.send({ count: tot, update: minutes(newestRecord.last_updated) })
  } catch (error) {
    const origin = req.headers['x-origin']
    logger.error(
      {
        type: 'api',
        params: req.query,
        error: error.message,
        origin: origin === 'frontend' ? 'frontend' : 'api',
      },
      `An error occured on the /tradestotal route`
    )

    return res.status(500).json({ error: error.message })
  }
})

app.get('/api/trades-paginated', limiter, async (req, res) => {
  try {
    const origin = req.headers['x-origin']
    const page = req.query.page ? parseInt(req.query.page) : 1
    const sqlQuery = parse(req.query, 50, page)
    const data = await getOrSetToCache(`/trades?${sqlQuery[0]}${sqlQuery[1]}${sqlQuery[2]}`.toLowerCase(), () =>
      convertTime(db.prepare(sqlQuery[0]).all(...sqlQuery[1]))
    )
    logger.info(
      {
        type: 'api',
        route: 'trades-paginated',
        page: page,
        query: req.query,
        origin: origin === 'frontend' ? 'frontend' : 'api',
      },
      'Trades-paginated hit'
    )
    res.send(data)
  } catch (error) {
    const origin = req.headers['x-origin']
    logger.error(
      {
        type: 'api',
        params: req.query,
        error: error.message,
        origin: origin === 'frontend' ? 'frontend' : 'api',
      },
      `An error occured on the /trades-paginated route`
    )

    return res.status(500).json({ error: error.message })
  }
})

const tradesLimiter = rateLimit({
  windowMs: 30 * 1000,
  max: 30,
  message: { error: 'Rate limit exceeded', status: 429 },
})

app.get('/api/trades', tradesLimiter, async (req, res) => {
  try {
    const sqlQuery = parse(req.query, 1000)
    const data = await getOrSetToCache(`/api/trades?${sqlQuery[0]}${sqlQuery[1]}${sqlQuery[2]}`, () =>
      db.prepare(sqlQuery[0]).all(...sqlQuery[1])
    )
    const newestRecord = db.prepare('SELECT * FROM records ORDER BY last_updated DESC LIMIT 1;').get()
    const tot =
      Object.keys(req.query).filter(key => validParameters.includes(key)).length > 0
        ? await getOrSetToCache(
            `/${sqlQuery[0]}${sqlQuery[1]}${sqlQuery[2]}/tot`,
            () => db.prepare(sqlQuery[2]).get(...sqlQuery[1]).count
          )
        : newestRecord.records
    logger.info(
      {
        type: 'api',
        route: 'trades',
        query: sqlQuery[0],
        origin: 'api',
      },
      'Trades hit'
    )
    return res.json({ count: tot, trades: data, last_updated: newestRecord.last_updated })
  } catch (error) {
    logger.error(
      {
        type: 'api',
        params: req.query,
        error: error.message,
        origin: 'api',
      },
      `An error occured on the /trades route`
    )

    return res.status(500).json({ error: error.message })
  }
})

app.get('/api/trades-wrapped', async (req, res) => {
  let { nation } = req.query
  nation = nation.toLowerCase().replaceAll(' ', '_')

  try {
    const cacheKey = `/api/trades-wrapped?nation=${nation}`

    const yearly = await getOrSetToCache(
      cacheKey,
      async () => {
        const startTimestamp = 1735689600
        const endTimestamp = 1767225599

        const { buyTot } = db
          .prepare(`SELECT COUNT(*) as buyTot FROM trades WHERE buyer COLLATE NOCASE = ? AND timestamp BETWEEN ? AND ?`)
          .get(String(nation), startTimestamp, endTimestamp)
        const { sellTot } = db
          .prepare(
            `SELECT COUNT(*) as sellTot FROM trades WHERE seller COLLATE NOCASE = ? AND timestamp BETWEEN ? AND ?`
          )
          .get(String(nation), startTimestamp, endTimestamp)
        if (buyTot === 0 && sellTot === 0) return { buyTot: 0, sellTot: 0 }

        const earliestBuy = db
          .prepare(
            `SELECT * FROM trades WHERE buyer COLLATE NOCASE = ? AND timestamp BETWEEN ? AND ? ORDER BY timestamp ASC LIMIT 1`
          )
          .get(nation, startTimestamp, endTimestamp)
        const earliestSell = db
          .prepare(
            `SELECT * FROM trades WHERE seller COLLATE NOCASE = ? AND timestamp BETWEEN ? AND ? ORDER BY timestamp ASC LIMIT 1`
          )
          .get(nation, startTimestamp, endTimestamp)

        const mostExpensiveBuy = db
          .prepare(
            `SELECT * FROM trades WHERE buyer COLLATE NOCASE = ? AND timestamp BETWEEN ? AND ? ORDER BY price DESC LIMIT 1`
          )
          .get(nation, startTimestamp, endTimestamp)
        const mostExpensiveSale = db
          .prepare(
            `SELECT * FROM trades WHERE seller COLLATE NOCASE = ? AND timestamp BETWEEN ? AND ? ORDER BY price DESC LIMIT 1`
          )
          .get(nation, startTimestamp, endTimestamp)

        const mostTradedCategory = db
          .prepare(
            `SELECT category, COUNT(*) as count FROM trades WHERE buyer COLLATE NOCASE = ? AND timestamp BETWEEN ? AND ? GROUP BY category ORDER BY count DESC LIMIT 1`
          )
          .get(nation, startTimestamp, endTimestamp) || { rarity: '', count: 0 }
        const mostTradedCategorySold = db
          .prepare(
            `SELECT category, COUNT(*) as count FROM trades WHERE seller COLLATE NOCASE = ? AND timestamp BETWEEN ? AND ? GROUP BY category ORDER BY count DESC LIMIT 1`
          )
          .get(nation, startTimestamp, endTimestamp) || { rarity: '', count: 0 }

        const mostTradedSeason = db
          .prepare(
            `SELECT season, COUNT(*) as count FROM trades WHERE buyer COLLATE NOCASE = ? AND timestamp BETWEEN ? AND ? GROUP BY season ORDER BY count DESC LIMIT 1`
          )
          .get(nation, startTimestamp, endTimestamp) || { season: 4, count: 0 }
        const mostTradedSeasonSold = db
          .prepare(
            `SELECT season, COUNT(*) as count FROM trades WHERE seller COLLATE NOCASE = ? AND timestamp BETWEEN ? AND ? GROUP BY season ORDER BY count DESC LIMIT 1`
          )
          .get(nation, startTimestamp, endTimestamp) || { season: 4, count: 0 }

        return {
          buyTot,
          sellTot,
          earliestBuy,
          earliestSell,
          mostExpensiveBuy,
          mostExpensiveSale,
          mostTradedCategory: { rarity: mostTradedCategory.category || '', count: mostTradedCategory.count },
          mostTradedSeason,
          mostTradedCategorySold: {
            rarity: mostTradedCategorySold.category || '',
            count: mostTradedCategorySold.count,
          },
          mostTradedSeasonSold,
        }
      },
      3600
    )

    res.json(yearly)
  } catch (err) {
    console.error('Error in /trades-wrapped:', err)
    res.status(500).json({ error: err.message })
  }
})

const dailyLimiter = rateLimit({
  windowMs: 24 * 60 * 60 * 1000,
  max: 2,
  message: { error: 'Daily limit exceeded', status: 429 },
})

app.get('/api/daily', dailyLimiter, async (req, res) => {
  try {
    const day = req.query.day

    if (!day || !/^\d{4}-\d{2}-\d{2}$/.test(day)) {
      return res.status(400).json({ error: 'Invalid date format. Expected YYYY-MM-DD.' })
    }

    const query = db
      .prepare(
        `
        SELECT
            DATE(DATETIME(timestamp, 'unixepoch')) AS trade_day,
            season,
            category,
            COUNT(*) AS total_trades,
            SUM(price) AS total_price,
            COUNT(DISTINCT buyer) AS total_buyers,
            COUNT(DISTINCT seller) AS total_sellers,
            SUM(CASE WHEN price = 0 THEN 1 ELSE 0 END) AS total_gifts
        FROM
            trades
        WHERE
            DATE(DATETIME(timestamp, 'unixepoch')) = ?
        GROUP BY
            trade_day,
            season,
            category
      `
      )
      .all(day)

    logger.info(
      {
        type: 'api',
        route: 'trades-daily',
        query: day,
        origin: 'api',
      },
      'Trades hit'
    )

    const count = query.length
    return res.json({ trades: query, count: count })
  } catch (error) {
    logger.error(
      {
        type: 'api',
        params: req.query,
        error: error.message,
        origin: 'api',
      },
      'An error occurred on the /daily route'
    )

    return res.status(500).json({ error: error.message })
  }
})

app.get('/api/health', async (req, res) => {
  res.status(200).send()
})

const downloadLimiter = rateLimit({
  windowMs: 24 * 60 * 60 * 1000,
  max: 1,
  message: { error: 'Daily limit exceeded', status: 429 },
})

app.get('/api/download/db', downloadLimiter, (req, res, message) => {
  const filePath = join(__dirname, 'trades.db')
  if (message.destroyed) {
    logger.info('User aborted download request for db')
    return
  }

  const stats = statSync(filePath)

  res.download(filePath, err => {
    if (err) {
      logger.error(
        {
          type: 'api',
          params: req.query,
          origin: 'api',
        },
        `An error occured while downloading the database`
      )
      res.status(404).send('File not found')
    } else {
      logger.info(
        {
          type: 'api',
          size: stats.size,
          origin: 'api',
        },
        'Database downloaded'
      )
    }
  })
})

const validApiKey = process.env.API_KEY

function checkApiKey(req) {
  const apiKey = req.headers['x-api-key']
  if (!apiKey || apiKey !== validApiKey) {
    return false
  }
  return true
}

app.post('/api/insert', async (req, res) => {
  if (!checkApiKey(req)) {
    return res.status(403).send('Forbidden: Invalid API Key')
  }

  const trades = req.body.trades

  const insertQuery = db.prepare(`
    INSERT INTO trades (buyer, seller, card_id, category, price, season, timestamp, card_name)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `)
  try {
    db.transaction(() => {
      trades.forEach(trade => {
        insertQuery.run(
          trade.buyer,
          trade.seller,
          trade.card_id,
          trade.category,
          trade.price,
          trade.season,
          trade.timestamp,
          trade.card_name
        )
      })
    })()

    const current_timestamp = Math.round(Date.now() / 1000)
    const num_rows = db.prepare('SELECT COUNT(*) AS count FROM trades').get().count
    const new_record = [num_rows, current_timestamp]

    db.prepare('INSERT INTO records (records, last_updated)  VALUES (?, ?)').run(new_record)

    /*
      Whatever its too late to fix this stop flushing for now
      its not that big of a deal
      nobody uses bazaar anyways and they expire after 5 minutes
    */
    //await RedisClient.flushall()

    res.status(200).send('Trades inserted successfully')
  } catch (error) {
    logger.error({ error, origin: 'api' }, 'Error inserting trades into database')
    res.status(500).send('Error inserting trades')
  }
})

app.get('/api/latest-timestamp', (req, res) => {
  if (!checkApiKey(req)) {
    return res.status(403).send('Forbidden: Invalid API Key')
  }

  const newestRecord = db.prepare('SELECT TIMESTAMP FROM trades ORDER BY timestamp DESC LIMIT 1;').get()

  if (!newestRecord || !newestRecord.timestamp) {
    return res.json({ sincetime: 1522549492 })
  }

  const sincetime = newestRecord.timestamp + 1
  return res.json({ sincetime })
})

app.listen(port, () => {
  logger.info(`App started and listening on ${port}`)
})
