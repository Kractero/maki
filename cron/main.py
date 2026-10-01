import requests
import xml.etree.ElementTree as ET
from time import sleep
import datetime
import os
import sys
import logging
import json
from dotenv import load_dotenv
import sqlite3

load_dotenv()

logging.basicConfig(filename='app.log', level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

api_key = os.getenv('API_KEY')
webhook = os.getenv('WEBHOOK')

headers = {
    "x-api-key": api_key
}

response = requests.get("https://maki.kractero.com/api/latest-timestamp", headers=headers)

if response.status_code == 200:
    data = response.json()
    sincetime = data['sincetime']
    logging.info(f"Sincetime retrieved successfully: {sincetime}")
else:
    logging.error(f"Failed to get sincetime: {response.status_code} - {response.reason}")
    response = requests.post(
        webhook,
        json={"content": f"Bazaar failed to get sincetime - {response.status_code} - {response.reason}!"},
        headers={"Accept": "application/json", "Content-Type": "application/json"}
    )
    sys.exit("Exiting script due to failure to retrieve sincetime.")

db_path = '/app/cardids.db'

def getLatestTradesIteratively():
    cards_con = sqlite3.connect(db_path)
    cards_cur = cards_con.cursor()

    timestamp = round(datetime.datetime.now().timestamp())
    batch_num = 0

    while True:
        url = f"https://www.nationstates.net/cgi-bin/api.cgi?q=cards+trades;limit=1000;beforetime={timestamp};sincetime={sincetime}"
        ns_headers = {"User-Agent": "Kractero using Bazaar rate limiting testing by Kractero"}

        response = requests.get(url, headers=ns_headers)

        ratelimit_remaining = response.headers.get('RateLimit-Remaining')
        ratelimit_reset = response.headers.get('RateLimit-Reset')
        retry_after = response.headers.get('Retry-After')

        if response.status_code not in (200, 429):
            logging.error(f"NS returned {response.status_code}")
            requests.post(
                webhook, 
                json={"content": f"Bazaar NS fetch failed - {response.status_code}"},
                headers={"Accept": "application/json", "Content-Type": "application/json"}
            )
            sys.exit("Exiting script due to NationStates response error.")
        
        if response.status_code == 429:
            if retry_after:
                wait_time = int(retry_after) if retry_after else int(ratelimit_reset or 30)
            else:
                wait_time = int(ratelimit_reset) / int(ratelimit_remaining) if ratelimit_remaining else int(ratelimit_reset)
            logging.info(f"Rate limit exceeded. Sleeping for {wait_time} seconds.")
            sleep(wait_time)
            continue

        root = ET.fromstring(response.text)
        trades = root.findall('.//TRADE')

        if not trades:
            logging.info("No more trades found.")
            break

        timestamp = trades[-1].find('TIMESTAMP').text
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
            ts = trade_elem.find('TIMESTAMP').text
            cards_cur.execute("SELECT name FROM cards WHERE id = ?", (card_id,))

            name = cards_cur.fetchone()
            if name:
                name = name[0]

            entry = {
                "buyer": buyer,
                "card_id": int(card_id),
                "category": category,
                "price": float(price) if price else 0.0,
                "season": int(season),
                "seller": seller,
                "timestamp": int(ts),
                "card_name": name
            }
            data.append(entry)

        insert_headers = {
            "x-api-key": api_key,
            'Accept': 'application/json',
            'Content-Type': 'application/json'
        }

        for i in range(0, len(data), 500):
            chunk = data[i:i + 500]
            batch_num += 1
            resp = requests.post(
                "https://maki.kractero.com/api/insert",
                data=json.dumps({"trades": chunk}).encode('utf-8'),
                headers=insert_headers
            )
            if resp.status_code == 200:
                logging.info(f"Trades inserted successfully (batch {batch_num}).")
            else:
                logging.error(f"Failed to insert trades: {resp.status_code} - {resp.reason}")
                requests.post(
                    webhook,
                    json={"content": f"Bazaar failed to insert trades - {resp.status_code} - {resp.reason}!"},
                    headers={"Accept": "application/json", "Content-Type": "application/json"}
                )

        if ratelimit_remaining and int(ratelimit_remaining) > 0:
            wait_time = int(ratelimit_reset) / int(ratelimit_remaining)
            logging.info(f"Rate limit remaining. Sleeping for {wait_time} seconds.")
            sleep(wait_time)
        else:
            wait_time = int(ratelimit_reset)
            logging.info(f"Sleeping for {wait_time} seconds until rate limit reset.")
            sleep(wait_time)

    cards_con.close()

getLatestTradesIteratively()
