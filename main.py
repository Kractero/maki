import urllib.request
import urllib.parse
import xml.etree.ElementTree as ET
from time import sleep
import sqlite3

def getLatestTradesRecursivelyWithoutUpdate():
    con = sqlite3.connect("updated_trades.db")

    cur = con.cursor()

    create_table_sql = '''
    CREATE TABLE IF NOT EXISTS trades (
        buyer TEXT,
        card_id INTEGER,
        category TEXT,
        price REAL,
        season INTEGER,
        seller TEXT,
        timestamp INTEGER,
        UNIQUE(buyer, card_id, category, price, season, seller, timestamp)
    )
    '''

    cur.execute(create_table_sql)

    getLatestThousandTrades(1704840022)

    con.commit()

def getLatestThousandTrades(timestamp):
    sleep(0.7)
    url = f"https://www.nationstates.net/cgi-bin/api.cgi?q=cards+trades;limit=1000;beforetime={timestamp};sincetime=1697289957"
    headers = {"User-Agent": "Kractero"}

    request = urllib.request.Request(url, headers=headers)
    response = urllib.request.urlopen(request)

    xml = response.read().decode('utf-8')
    root = ET.fromstring(xml)

    trades = root.findall('.//TRADE')

    if not trades:
        return

    timestamp = 0
    data = []
    for trade_elem in trades:
        buyer = trade_elem.find('BUYER').text
        card_id = trade_elem.find('CARDID').text
        category = trade_elem.find('CATEGORY').text
        price = trade_elem.find('PRICE').text if trade_elem.find('PRICE') is not None else 0.0
        season = trade_elem.find('SEASON').text
        seller = trade_elem.find('SELLER').text
        timestamp = trade_elem.find('TIMESTAMP').text

        print (timestamp)

        if price is None:
            price = 0.0

        entry = tuple([buyer, int(card_id), category[0], float(price), int(season), seller, int(timestamp)])
        data.append(entry)

    cur.executemany("INSERT OR IGNORE INTO trades VALUES (?, ?, ?, ?, ?, ?, ?)", data)

    getLatestThousandTrades(timestamp)


def build_from_9003():
    con = sqlite3.connect("trades.db")

    cur = con.cursor()

    create_table_sql = '''
    CREATE TABLE IF NOT EXISTS trades (
        buyer TEXT,
        card_id INTEGER,
        category TEXT,
        price REAL,
        season INTEGER,
        seller TEXT,
        timestamp INTEGER,
        UNIQUE(buyer, card_id, category, price, season, seller, timestamp)
    )
    '''

    cur.execute(create_table_sql)

    file = open('Full Dump.txt', mode = 'r', encoding = 'utf8')
    trade = file.readlines()

    data = []

    for line in trade:

        arr = line.split()

        timestamp = arr.pop(0)
        arr.append(int(timestamp))

        if arr[3] == 'None':
            arr[3] = 0.0
        else:
            arr[3] = float(arr[3])
        
        arr[4] = int(arr[4])
        arr[1] = int(arr[1])
        arr[2] = arr[2][0]

        data.append(tuple(arr))

    cur.executemany("INSERT OR IGNORE INTO trades VALUES (?, ?, ?, ?, ?, ?, ?)", data)
    con.commit()

build_from_9003()