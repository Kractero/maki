const Database = require('better-sqlite3');

const db = new Database('trades.db', { verbose: console.log });

const express = require('express')
const app = express()

app.set("view engine", "ejs")

app.get('/', function (req, res) {
  res.render("index")
})

const validParameters = ["buyer", "cardid", "category", "price", "season", "seller", "beforetimestamp", "aftertimestamp"]

app.get('/trades', function (req, res) {
  const params = Object.keys(req.query)
  params.forEach(param => {
    if (!validParameters.includes(param)) {
      throw new Error("Invalid parameter")
    }
  })
  console.log(req.query.seller)
  const stmt = db.prepare('SELECT * FROM trades WHERE buyer COLLATE NOCASE = (?) ORDER BY timestamp desc').all(req.query.seller);
  return res.json(stmt)
})

app.listen(3000)