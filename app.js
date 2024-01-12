import Database from "better-sqlite3"
import express from "express"
import { join } from "path"
import { parse } from "./parse.js";
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const db = new Database('trades.db');

const app = express()
app.set("view engine", "ejs")

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

app.use(express.static(join(__dirname + "/public")));

app.get('/', (req, res) => {
  const sqlQuery = parse(req.query, 50, 1)
  const data = db.prepare(sqlQuery[0]).all(...sqlQuery[1]).map(entry => {
    const currentTime = Math.floor(Date.now() / 1000);
    const timeDifference = currentTime - entry.timestamp;

    if (timeDifference < 60) {
      entry.timestamp = `${timeDifference} second${timeDifference !== 1 ? 's' : ''} ago`;
    } else if (timeDifference < 3600) {
      const minutes = Math.floor(timeDifference / 60);
      const secondsRemainder = timeDifference % 60;
      entry.timestamp = `${minutes} minute${minutes !== 1 ? 's' : ''} ${secondsRemainder} second${secondsRemainder !== 1 ? 's' : ''} ago`;
    } else if (timeDifference < 86400) {
      const hours = Math.floor(timeDifference / 3600);
      const minutesRemainder = Math.floor((timeDifference % 3600) / 60);
      entry.timestamp = `${hours} hour${hours !== 1 ? 's' : ''} ${minutesRemainder} minute${minutesRemainder !== 1 ? 's' : ''} ago`;
    } else if (timeDifference < 2592000) {
      const days = Math.floor(timeDifference / 86400);
      const hoursRemainder = Math.floor((timeDifference % 86400) / 3600);
      entry.timestamp = `${days} day${days !== 1 ? 's' : ''} ${hoursRemainder} hour${hoursRemainder !== 1 ? 's' : ''} ago`;
    } else if (timeDifference < 31536000) {
      const months = Math.floor(timeDifference / 2592000);
      const daysRemainder = Math.floor((timeDifference % 2592000) / 86400);
      entry.timestamp = `${months} month${months !== 1 ? 's' : ''} ${daysRemainder} day${daysRemainder !== 1 ? 's' : ''} ago`;
    } else {
      const years = Math.floor(timeDifference / 31536000);
      const monthsRemainder = Math.floor((timeDifference % 31536000) / 2592000);
      entry.timestamp = `${years} year${years !== 1 ? 's' : ''} ${monthsRemainder} month${monthsRemainder !== 1 ? 's' : ''} ago`;
    }

    return entry;
  })

  const querystring = Object.keys(req.query).map(key => {
    if (req.query[key] && key !== "page") {
      return `${encodeURIComponent(key)}=${encodeURIComponent(req.query[key])}`
    }
  }).filter(param => param).join('&')

  const nextPageUrl = `/trades?page=2&${querystring}`;
  res.render("index", { data: data, qs: req.query, qlery: nextPageUrl })
})

app.get('/trades', (req, res) => {
  const page = req.query.page ? parseInt(req.query.page) + 1 : 1;
  const sqlQuery = parse(req.query, 50, page)
  console.log(sqlQuery)
  const data = db.prepare(sqlQuery[0]).all(...sqlQuery[1])
  const querystring = Object.keys(req.query).map(key => {
    if (req.query[key] && key !== "page") {
      return `${encodeURIComponent(key)}=${encodeURIComponent(req.query[key])}`
    }
  }).filter(param => param).join('&')
  if (data.length === 0) {
    res.render("trade", { data: `<p class="text-red-200">No trades found with the requested parameters.</p>` })
  } else {
    res.send(`
      ${data.map((entry, index) =>`
      <tr ${index === data.length - 1 ? `hx-get=/trades?${querystring}&page=${page} hx-trigger=revealed hx-swap=afterend` : ''}>
        <td class="border border-slate-600 p-2 break-words
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
        <td class="border border-slate-600 p-2 break-words">
          <a target="_blank" rel="noreferrer noopener" class="hover:underline"
            href="https://nationstates.net/nation=${entry.seller}">
            ${entry.seller}
          </a>
        </td>
        <td class="border border-slate-600 p-2 break-words">
          <a target="_blank" rel="noreferrer noopener" class="hover:underline"
            href="https://nationstates.net/nation=${entry.buyer}">
            ${entry.buyer}
          </a>
        </td>
        <td class="border border-slate-600 p-2 break-words">${entry.price}</td>
        <td class="border border-slate-600 p-2 break-words">${entry.timestamp}</td>
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

app.listen(3000)