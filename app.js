import Database from "better-sqlite3"
import express from "express"
import { join } from "path"
import { parse } from "./util/parse.js";
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { convertTime } from "./util/convertTime.js";
import { buildQS } from "./util/buildQS.js";
import { rateLimit } from 'express-rate-limit'
import compression from "compression";
import helmet from "helmet";
import cors from "cors";
import { getOrSetToCache } from "./util/getOrSetToCache.js";
import { logger } from "./util/logger.js";
import "dotenv/config.js";
import { minutes } from "./util/timeSinceUpdate.js";
import { marked } from "marked";
import { readFileSync, statSync } from "fs";

const port = process.env.PORT || 3000;

const db = new Database('trades.db');
// db.pragma('journal_mode = WAL');
db.pragma('journal_mode = DELETE');

const app = express()
app.set("view engine", "ejs")

const limiter = rateLimit({
  windowMs: 30 * 1000,
  max: 50,
  message: { error: 'Rate limit exceeded', status: 429 },
});

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

app.use(compression());
app.use(helmet.contentSecurityPolicy({
  directives: {
    defaultSrc: ["'self'"],
    scriptSrc: [
      "'self'",
      'https://unpkg.com',
      'https://nakiri.vercel.app',
      "'unsafe-inline'"
    ],
    connectSrc: [
      "'self'",
      'https://nakiri.vercel.app'
    ],
  },
}));
app.use(cors());
app.use(express.static(join(__dirname + "/public")));
const validParameters = ["buyer", "seller", "cardid", "category", "minprice", "maxprice", "price", "season", "beforetime", "sincetime"]

app.get('/', async (req, res) => {
  try {
    const queryParameters = req.query;
    const sqlQuery = parse(req.query, 50, 1)
    const data = await getOrSetToCache(`/trades?${sqlQuery[0]}${sqlQuery[1]}${sqlQuery[2]}`.toLowerCase(), () => convertTime(db.prepare(sqlQuery[0]).all(...sqlQuery[1])))
    if (req.query.hasOwnProperty('category') && req.query['category'].toLowerCase() === 'all') {
      delete queryParameters['category'];
    }
    const newestRecord = db.prepare('SELECT * FROM records ORDER BY last_updated DESC LIMIT 1;').get();
    sqlQuery[2] = sqlQuery[2].replace('*', "COUNT(*) AS total_count")
    const tot = Object.keys(req.query).filter(key => validParameters.includes(key)).length > 0 ? await getOrSetToCache(`/tradestotal?${sqlQuery[1]}`.toLowerCase(), () => db.prepare(sqlQuery[2]).all(...sqlQuery[1]).length) : newestRecord.records
    if (Array.isArray(tot)) tot = tot[0] ? tot[0].total_count : 0
    const querystring = buildQS(req.query)
    const nextPageUrl = `/trades?page=2&${querystring}`;
    logger.info(`BASE ROUTE - ${querystring} / completed`)
    res.render("index", { data: data, qs: req.query, qlery: nextPageUrl, total: tot, update: minutes(newestRecord.last_updated), count: newestRecord.records })
  } catch (err) {
    logger.error({
      params: req.query
    }, `An error occured on the / route: ${err}`)
  }
})

app.get('/tradestotal', async (req, res) => {
  try {
    const queryParameters = req.query;
    if (queryParameters.hasOwnProperty('category') && queryParameters['category'].toLowerCase() === 'all') {
      delete queryParameters['category'];
    }
    const page = queryParameters.page ? parseInt(queryParameters.page) + 1 : 1;
    const sqlQuery = parse(queryParameters, 50, page, "count")
    const newestRecord = db.prepare('SELECT * FROM records ORDER BY last_updated DESC LIMIT 1;').get();
    let tot = Object.keys(req.query).filter(key => validParameters.includes(key)).length > 0 ? await getOrSetToCache(`/tradestotal?${sqlQuery[1]}`.toLowerCase(), () => db.prepare(sqlQuery[2]).all(...sqlQuery[1])) : newestRecord.records
    if (Array.isArray(tot)) tot = tot[0] ? tot[0].total_count : 0
    logger.info(`TRADES TOTAL - /tradestotal ${tot} completed`)
    res.send({ count: tot, update: minutes(newestRecord.last_updated) })
  } catch (err) {
    logger.error({
      params: req.query
    }, `An error occured on the /tradestotal route: ${err}`)
  }
})

app.get('/trades', async (req, res) => {
  try {
    const page = req.query.page ? parseInt(req.query.page) + 1 : 1;
    const sqlQuery = parse(req.query, 50, page)
    const data = await getOrSetToCache(`/trades?${sqlQuery[0]}${sqlQuery[1]}${sqlQuery[2]}`.toLowerCase(), () => convertTime(db.prepare(sqlQuery[0]).all(...sqlQuery[1])))
    const querystring = buildQS(req.query)
    logger.info(`TRADES PAGINATED - ${querystring} / completed`)
    if (data.length === 0) {
      res.send(``)
    } else {
      res.send(`
        ${data.map((entry, index) => `
        <tr ${index === data.length - 1 ? `hx-get=/trades?${querystring}&page=${page} hx-trigger=revealed hx-swap=afterend` : ''}>
          <td class="border border-slate-600 p-2 break-words text-xs sm:text-base
            ${entry.category === "c" ? 'text-gray-500' :
          entry.category === "u" ? 'text-green-500' :
            entry.category === "r" ? 'text-blue-500' :
              entry.category === "ur" ? 'text-purple-500' :
                entry.category === "e" ? 'text-yellow-600' :
                  entry.category === "l" ? 'text-yellow-400' : ''
        }">
            <a target="_blank" rel="noreferrer noopener" class="hover:underline"
              href="https://nationstates.net/page=deck/card=${entry.card_id}/season=${entry.season}">
              S${entry.season} ${entry.card_name}
            </a>
          </td>
          <td class="border border-slate-600 p-2 break-words text-xs sm:text-base">
            <a target="_blank" rel="noreferrer noopener" class="hover:underline"
              href="https://nationstates.net/nation=${entry.seller}">
              ${entry.seller}
            </a>
          </td>
          <td class="border border-slate-600 p-2 break-words text-xs sm:text-base">
            <a target="_blank" rel="noreferrer noopener" class="hover:underline"
              href="https://nationstates.net/nation=${entry.buyer}">
              ${entry.buyer}
            </a>
          </td>
          <td class="border border-slate-600 p-2 break-words text-xs sm:text-base">${entry.price}</td>
          <td class="border border-slate-600 p-2 break-words text-[0.5rem] sm:text-base">${entry.timestamp}</td>
        </tr>
        `).join('')}
      `)
    }
  } catch (err) {
    logger.error({
      params: req.query
    }, `An error occured on the /trades route: ${err}`)
  }
})

app.get('/api/trades', limiter, async (req, res) => {
  try {
    const sqlQuery = parse(req.query, 1000)
    const data = await getOrSetToCache(`/api/trades?${sqlQuery[0]}${sqlQuery[1]}${sqlQuery[2]}`, () => db.prepare(sqlQuery[0]).all(...sqlQuery[1]))
    const newestRecord = db.prepare('SELECT * FROM records ORDER BY last_updated DESC LIMIT 1;').get();
    const tot = Object.keys(req.query).filter(key => validParameters.includes(key)).length > 0 ? await getOrSetToCache(`/${sqlQuery[0]}${sqlQuery[1]}${sqlQuery[2]}/tot`, () => db.prepare(sqlQuery[2]).all(...sqlQuery[1]).length) : newestRecord.records
    logger.info(`API TRADES - ${sqlQuery[0]} / completed`)
    return res.json({ "count": tot, trades: data, "last_updated": newestRecord.last_updated })
  } catch (err) {
    logger.error({
      params: req.query
    }, `An error occured on the /api/trades route: ${err}`)
  }
})

app.get('/health', async (req, res) => {
  logger.info("We live")
  res.status(200).send();
});

app.get('/docs', function (req, res) {
  const include = readFileSync(`${__dirname}/views/docs.md`, 'utf8');
  const html = marked(include);
  res.render('docs', { "md": html });
});

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
});

app.get('/download/db', downloadLimiter, (req, res) => {
  const filePath = join(__dirname, 'trades.db');
  if (req.aborted) {
    logger.info("User aborted download request for db")
    return;
  }

  const stats = statSync(filePath);

  res.download(filePath, (err) => {
    if (err) {
      logger.error(err, `An error occurred while downloading the database`);
      res.status(404).send('File not found');
    } else {
      logger.info(`DATABASE DOWNLOADED !!!!!! Size: ${stats.size} bytes`);
    }
  });
});

app.listen(port, () => {
  logger.info(`App started and listening on ${port}`)
})
