import urllib.request
import urllib.parse
import xml.etree.ElementTree as ET
from time import sleep
import sqlite3
import datetime
# import sys
import redis
import os
from dotenv import load_dotenv

# sys.setrecursionlimit(10000)

def getLatestTradesRecursivelyWithoutUpdate():
    con = sqlite3.connect("trades.db")

    cur = con.cursor()

    cards_con = sqlite3.connect("cardids.db")

    cards_cur = cards_con.cursor()

    # create_table_sql = '''
    # CREATE TABLE IF NOT EXISTS trades (
    #     buyer TEXT,
    #     card_id INTEGER,
    #     category TEXT,
    #     price REAL,
    #     season INTEGER,
    #     seller TEXT,
    #     timestamp INTEGER,
    #     card_name TEXT
    # )
    # '''

    # cur.execute(create_table_sql)

    sincetime = 1522549492
    for row in cur.execute("SELECT * FROM trades ORDER BY timestamp DESC LIMIT 1"):
        sincetime = row[6] + 1

    def getLatestThousandTrades(timestamp=round(datetime.datetime.now().timestamp())):
        sleep(0.7)
        url = f"https://www.nationstates.net/cgi-bin/api.cgi?q=cards+trades;limit=1000;beforetime={timestamp};sincetime={sincetime}"
        headers = {"User-Agent": "Kractero using Bazaar by Kractero"}

        request = urllib.request.Request(url, headers=headers)
        response = urllib.request.urlopen(request)

        xml = response.read().decode('utf-8')
        root = ET.fromstring(xml)

        trades = root.findall('.//TRADE')

        if not trades:
            return

        next_recursive_timestamp = trades[-1].find('TIMESTAMP').text
        data = []
        for trade_elem in trades:
            buyer = trade_elem.find('BUYER').text
            card_id = trade_elem.find('CARDID').text
            category = trade_elem.find('CATEGORY').text
            if category == "ultra-rare":
                category = 'ur'
            else:
                category = category[0]
            price = trade_elem.find('PRICE').text if trade_elem.find('PRICE') is not None else 0.0
            season = trade_elem.find('SEASON').text
            seller = trade_elem.find('SELLER').text
            timestamp = trade_elem.find('TIMESTAMP').text
            cards_cur.execute("""
                SELECT name
                FROM cards
                WHERE id = ?
            """, (card_id,))

            name = cards_cur.fetchone()

            if name:
                name = name[0]

            if price is None:
                price = 0.0

            entry = tuple([buyer, int(card_id), category, float(price), int(season), seller, int(timestamp), name])
            data.append(entry)

        cur.executemany("INSERT INTO trades VALUES (?, ?, ?, ?, ?, ?, ?, ?)", data)

        getLatestThousandTrades(next_recursive_timestamp)

    getLatestThousandTrades()

    current_timestamp = round(datetime.datetime.now().timestamp())
    num_rows = cur.execute("SELECT COUNT(*) FROM trades").fetchone()[0]

    new_record = (num_rows, current_timestamp)

    cur.execute("INSERT INTO records VALUES (?, ?)", new_record)

    con.commit()
    con.close()
    cards_con.close()
    load_dotenv()
    redis_client = redis.StrictRedis(host=os.environ.get('REDIS_DOCKER_HOST', 'localhost'), port=int(os.environ.get('REDIS_PORT', 6379)), db=0)

    redis_client.flushall()
getLatestTradesRecursivelyWithoutUpdate()