import urllib.request
import urllib.parse
import xml.etree.ElementTree as ET
from time import sleep
import sqlite3
import datetime
import redis
import os
from dotenv import load_dotenv

# def mapCardName():
#     # con = sqlite3.connect("updated_trades.db")
#     con = sqlite3.connect("trades - Copy.db")

#     cur = con.cursor()

#     cur.execute("ATTACH DATABASE 'cardids.db' AS cardsdb")

#     cur.execute("""
#         UPDATE trades
#         SET name = (
#             SELECT name
#             FROM cardsdb.cards
#             WHERE cardsdb.cards.id = trades.card_id
#         )
#         WHERE card_name IS NULL;  -- Update only rows where 'card_name' is not already set
#     """)
#     con.commit()
#     con.close()

def getLatestTradesRecursivelyWithoutUpdate():
    # con = sqlite3.connect("updated_trades.db")
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
    #     card_name TEXT,
    #     UNIQUE(buyer, card_id, category, price, season, seller, timestamp, card_name)
    # )
    # '''

    # cur.execute(create_table_sql)

    sincetime = 1522549491
    for row in cur.execute("SELECT * FROM trades ORDER BY timestamp DESC LIMIT 1"):
        sincetime = row[6]

    def getLatestThousandTrades(timestamp=datetime.datetime.now().timestamp()):
        sleep(0.7)
        url = f"https://www.nationstates.net/cgi-bin/api.cgi?q=cards+trades;limit=1000;beforetime={timestamp};sincetime={sincetime}"
        headers = {"User-Agent": "Kractero using Bazaar by Kractero"}

        request = urllib.request.Request(url, headers=headers)
        response = urllib.request.urlopen(request)

        xml = response.read().decode('utf-8')
        root = ET.fromstring(xml)

        trades = root.findall('.//TRADE')

        if not trades or len(trades) == 1:
            return

        next_recursive_timestamp = trades[-1].find('TIMESTAMP').text
        data = []
        for trade_elem in trades[:-1]:
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

            # print ((buyer, card_id, category, price, season, seller, timestamp, name))

            entry = tuple([buyer, int(card_id), category, float(price), int(season), seller, int(timestamp), name])
            data.append(entry)

        cur.executemany("INSERT INTO trades VALUES (?, ?, ?, ?, ?, ?, ?, ?)", data)

        getLatestThousandTrades(next_recursive_timestamp)

    getLatestThousandTrades()

    current_timestamp = int(datetime.datetime.now().timestamp())
    num_rows = cur.execute("SELECT COUNT(*) FROM trades").fetchone()[0]

    new_record = (num_rows, current_timestamp)

    cur.execute("INSERT INTO records VALUES (?, ?)", new_record)

    con.commit()

    con.close()
    cards_con.close()

    load_dotenv()
    redis_client = redis.StrictRedis(host=os.environ.get('REDIS_DOCKER_HOST', 'localhost'), port=int(os.environ.get('REDIS_PORT', 6379)), db=0)

    redis_client.flushall()

def data_table():
    con = sqlite3.connect("trades.db")

    cur = con.cursor()

    create_table_sql = '''
    CREATE TABLE IF NOT EXISTS records (
        records INTEGER,
        last_updated INTEGER
    )
    '''

    cur.execute(create_table_sql)
    con.commit()
    con.close()

# def build_from_9003():
#     con = sqlite3.connect("trades.db")
#     cards_con = sqlite3.connect("cardids.db")

#     cur = con.cursor()
#     cards_cur = cards_con.cursor()

#     create_table_sql = '''
#     CREATE TABLE IF NOT EXISTS trades (
#         buyer TEXT,
#         card_id INTEGER,
#         category TEXT,
#         price REAL,
#         season INTEGER,
#         seller TEXT,
#         timestamp INTEGER,
#         card_name TEXT
#     )
#     '''

#     cur.execute(create_table_sql)

#     file = open('Full Dump.txt', mode = 'r', encoding = 'utf8')
#     trade = file.readlines()

#     data = []

#     for line in trade:

#         arr = line.split()

#         timestamp = arr.pop(0)
#         arr.append(int(timestamp))

#         cards_cur.execute("""
#             SELECT name
#             FROM cards
#             WHERE id = ?
#         """, (arr[1],))

#         name = cards_cur.fetchone()

#         if name:
#             name = name[0]

#         if arr[3] == 'None':
#             arr[3] = 0.0
#         else:
#             arr[3] = float(arr[3])

#         arr[4] = int(arr[4])
#         arr[1] = int(arr[1])
#         if arr[2] == 'ultra-rare':
#             arr[2] = 'ur'
#         else:
#             arr[2] = arr[2][0]

#         arr.append(name)
#         data.append(tuple(arr))

#     cur.executemany("INSERT INTO trades VALUES (?, ?, ?, ?, ?, ?, ?, ?)", data)

#     con.commit()
#     con.close()

# def combine():
#     con3 = sqlite3.connect("trades.db")

#     con3.execute("ATTACH 'updated_trades.db' as dba")

#     con3.execute("BEGIN")
#     for row in con3.execute("SELECT * FROM dba.sqlite_master WHERE type='table'"):
#         combine = "INSERT OR IGNORE INTO "+ row[1] + " SELECT * FROM dba." + row[1]
#         con3.execute(combine)
#     con3.commit()
#     con3.execute("detach database dba")

# build_from_9003()
# data_table()
getLatestTradesRecursivelyWithoutUpdate()
# combine()
# mapCardName()