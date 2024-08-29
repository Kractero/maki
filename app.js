import Database from 'better-sqlite3'
import express from 'express'
import { join } from 'path'
import { parse } from './util/parse.js'
import { fileURLToPath } from 'url'
import { dirname } from 'path'
import { convertTime } from './util/convertTime.js'
import { buildQS } from './util/buildQS.js'
import { rateLimit } from 'express-rate-limit'
import compression from 'compression'
import helmet from 'helmet'
import cors from 'cors'
import { getOrSetToCache } from './util/getOrSetToCache.js'
import { logger } from './util/logger.js'
import 'dotenv/config.js'
import { minutes } from './util/timeSinceUpdate.js'
import { statSync } from 'fs'

const port = process.env.PORT || 3000

const db = new Database('trades.db')
// db.pragma('journal_mode = WAL');
db.pragma('journal_mode = DELETE')

const app = express()
app.set('view engine', 'ejs')

const limiter = rateLimit({
  windowMs: 30 * 1000,
  max: 50,
  message: { error: 'Rate limit exceeded', status: 429 },
})

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

app.use(compression())
app.use(
  helmet.contentSecurityPolicy({
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", 'https://unpkg.com', 'https://nakiri.vercel.app', "'unsafe-inline'"],
      connectSrc: ["'self'", 'https://nakiri.vercel.app'],
    },
  })
)
app.use(cors())
app.use(express.static(join(__dirname + '/public')))
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

app.get('/api/tradestotal', async (req, res) => {
  try {
    const queryParameters = req.query
    if (queryParameters.hasOwnProperty('category') && queryParameters['category'].toLowerCase() === 'all') {
      delete queryParameters['category']
    }
    const page = queryParameters.page ? parseInt(queryParameters.page) + 1 : 1
    const sqlQuery = parse(queryParameters, 50, page, 'count')
    const newestRecord = db.prepare('SELECT * FROM records ORDER BY last_updated DESC LIMIT 1;').get()
    let tot =
      Object.keys(req.query).filter(key => validParameters.includes(key)).length > 0
        ? await getOrSetToCache(`/tradestotal?${sqlQuery[1]}`.toLowerCase(), () =>
            db.prepare(sqlQuery[2]).all(...sqlQuery[1])
          )
        : newestRecord.records
    if (Array.isArray(tot)) tot = tot[0] ? tot[0].total_count : 0
    logger.info(`TRADES TOTAL - /tradestotal ${tot} completed`)
    res.send({ count: tot, update: minutes(newestRecord.last_updated) })
  } catch (err) {
    logger.error(
      {
        params: req.query,
      },
      `An error occured on the /tradestotal route: ${err}`
    )
  }
})

app.get('/api/trades-paginated', async (req, res) => {
  try {
    const page = req.query.page ? parseInt(req.query.page) : 1
    const sqlQuery = parse(req.query, 50, page)
    const data = await getOrSetToCache(`/trades?${sqlQuery[0]}${sqlQuery[1]}${sqlQuery[2]}`.toLowerCase(), () =>
      convertTime(db.prepare(sqlQuery[0]).all(...sqlQuery[1]))
    )
    const querystring = buildQS(req.query)
    logger.info(`TRADES PAGINATED - ${querystring} / completed`)
    res.send(data)
  } catch (err) {
    console.err
  }
})

app.get('/api/trades', limiter, async (req, res) => {
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
            () => db.prepare(sqlQuery[2]).all(...sqlQuery[1]).length
          )
        : newestRecord.records
    logger.info(`API TRADES - ${sqlQuery[0]} / completed`)
    return res.json({ count: tot, trades: data, last_updated: newestRecord.last_updated })
  } catch (err) {
    logger.error(
      {
        params: req.query,
      },
      `An error occured on the /api/trades route: ${err}`
    )
  }
})

app.get('/api/health', async (req, res) => {
  logger.info('We live')
  res.status(200).send()
})

// function readRecordsFromJson(nation) {
//   const jsonData = JSON.parse(readFileSync("trades.json", "utf-8"));
//   if (jsonData.hasOwnProperty(nation)) {
//     const data = jsonData[nation];
//     return data
//   }
// }

// app.get("/records/:nation", async (req, res) => {
//   let { nation } = req.params;
//   nation = nation.toLowerCase().replaceAll(' ', '_')
//   try {
//     const data = await getOrSetToCache(`/records:${nation}`, () => readRecordsFromJson(nation))
//     if (data) {
//       logger.info(`Records request for ${nation} served`)
//       res.json(data);
//     } else {
//       logger.error({
//         params: req.params
//       }, `An error occured on the /records/:nation route: ${nation} not found`)
//       res.status(404).json({ error: "Nation not found" });
//     }
//   } catch (err) {
//     logger.error({ params: req.params }, `An error occurred on the /records/:nation route: ${err}`);
//     res.status(500).json({ error: "Internal Server Error" });
//   }
// });

const downloadLimiter = rateLimit({
  windowMs: 24 * 60 * 60 * 1000,
  max: 1,
  message: { error: 'Daily download limit exceeded', status: 429 },
})

app.get('/api/download/db', downloadLimiter, (req, res) => {
  const filePath = join(__dirname, 'trades.db')
  if (req.aborted) {
    logger.info('User aborted download request for db')
    return
  }

  const stats = statSync(filePath)

  res.download(filePath, err => {
    if (err) {
      logger.error(err, `An error occurred while downloading the database`)
      res.status(404).send('File not found')
    } else {
      logger.info(`DATABASE DOWNLOADED !!!!!! Size: ${stats.size} bytes`)
    }
  })
})

app.listen(port, () => {
  logger.info(`App started and listening on ${port}`)
})
