import urllib.request
import urllib.parse
import xml.etree.ElementTree as ET
from time import sleep
import sqlite3

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