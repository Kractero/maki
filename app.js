const Database = require('better-sqlite3');

const db = new Database('trades.db', { verbose: console.log });

const express = require('express')
const app = express()
const path = require('path');

app.set("view engine", "ejs")

app.use(express.static(path.join(__dirname + "/public")));

app.get('/', (req, res) => {
  res.render("index")
})

const apiParameters = ["start", "limit"]
const validParameters = ["buyer", "cardid", "category", "minprice", "maxprice", "price", "season", "seller", "beforetimestamp", "aftertimestamp"]

const categories = ["common", "uncommon", "rare", "ultra-rare", "epic", "legendary"]

app.get('/trades', (req, res) => {
  const params = Object.keys(req.query)
  const queryParams = [];
  const sqlConditions = [];

  params.forEach(param => {
    if (!validParameters.includes(param) && !apiParameters.includes(param)) {
      throw new Error("Invalid parameter " + param)
    }

    if (!apiParameters.includes(param)) {
      let paramValue = req.query[param]
      if (param === "category") {
        if (categories.includes(req.query["category"])) {
          paramValue = req.query["category"] === "ultra-rare" ? "ur" : req.query["category"][0]
        }
      } else if (param === "minprice") {
        sqlConditions.push(`price >= (?)`);
      } else if (param === "maxprice") {
        sqlConditions.push(`price <= (?)`);
      } else if (param === "beforetimestamp") {
        sqlConditions.push(`timestamp < (?)`);
      } else if (param === "aftertimestamp") {
        sqlConditions.push(`timestamp > (?)`);
      } else {
        sqlConditions.push(`${param === "cardid" ? "card_id" : param} COLLATE NOCASE = (?)`);
      }

      let sqlQuery = 'SELECT * FROM trades';
      if (sqlConditions.length > 0) {
        sqlQuery += ` WHERE ${sqlConditions.join(' AND ')}`;
      }
      sqlQuery += ' ORDER BY timestamp DESC';
      queryParams.push(paramValue);
    }
  })
  let sqlQuery = 'SELECT * FROM trades';
  if (sqlConditions.length > 0) {
    sqlQuery += ` WHERE ${sqlConditions.join(' AND ')}`;
  }
  sqlQuery += ' ORDER BY timestamp DESC';

  const start = req.query.start ? parseInt(req.query.start) : 0;
  const limit = req.query.limit ? parseInt(req.query.limit) : 50;

  sqlQuery += ` LIMIT ${limit} OFFSET ${start}`;
  const stmt = db.prepare(sqlQuery).all(...queryParams);

  return res.json(stmt)
})

app.listen(3000)