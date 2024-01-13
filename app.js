import Database from "better-sqlite3"
import express from "express"
import { join } from "path"
import { parse } from "./util/parse.js";
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { convertTime } from "./util/convertTime.js";
import { buildQS } from "./util/buildQS.js";

const port = process.env.port || 3000;

const db = new Database('trades.db');

const app = express()
app.set("view engine", "ejs")

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

app.use(express.static(join(__dirname + "/public")));

app.get('/', (req, res) => {
  const queryParameters = req.query;
  if (queryParameters.hasOwnProperty('category') && queryParameters['category'].toLowerCase() === 'all') {
      delete queryParameters['category'];
  }
  const sqlQuery = parse(queryParameters, 50, 1)
  const data = convertTime(db.prepare(sqlQuery[0]).all(...sqlQuery[1]))
  const tot = Object.keys(queryParameters).length > 0 ? db.prepare(sqlQuery[2]).all(...sqlQuery[1]).length : db.prepare("SELECT COUNT(*) as total FROM trades").get().total
  const querystring = buildQS(queryParameters)

  const nextPageUrl = `/trades?page=2&${querystring}`;
  res.render("index", { data: data, qs: req.query, qlery: nextPageUrl, total: tot })
})

app.get('/tradestotal', (req, res) => {
  const queryParameters = req.query;
  if (queryParameters.hasOwnProperty('category') && queryParameters['category'].toLowerCase() === 'all') {
      delete queryParameters['category'];
  }
  const page = queryParameters.page ? parseInt(queryParameters.page) + 1 : 1;
  const sqlQuery = parse(queryParameters, 50, page)
  const test = Object.keys(queryParameters).length > 0 && queryParameters.category !== "All" ? db.prepare(sqlQuery[2]).all(...sqlQuery[1]).length : db.prepare("SELECT COUNT(*) as total FROM trades").get().total
  res.send({count: test})
})

app.get('/trades', (req, res) => {
  const page = req.query.page ? parseInt(req.query.page) + 1 : 1;
  const sqlQuery = parse(req.query, 50, page)
  const data = convertTime(db.prepare(sqlQuery[0]).all(...sqlQuery[1]))
  const querystring = buildQS(req.query)
  if (data.length === 0) {
    res.send(``)
  } else {
    res.send(`
      ${data.map((entry, index) =>`
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
})

app.get('/api/trades', (req, res) => {
  const sqlQuery = parse(req.query, 1000)
  const stmt = db.prepare(sqlQuery[0]).all(...sqlQuery[1]);
  return res.json(stmt)
})

app.listen(port)