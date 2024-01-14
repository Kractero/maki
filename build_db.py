import json
import sqlite3

def good_and_gather(jsonl_file_path):
  s1 = open(f"data/{jsonl_file_path}", 'r', encoding='utf-8')
  conn = sqlite3.connect('trades copy 2.db')
  cur = conn.cursor()

  create_tables_sql = '''
  CREATE TABLE IF NOT EXISTS cards (
      id INTEGER,
      name TEXT,
      PRIMARY KEY (id)
  );
  '''

  cur.executescript(create_tables_sql)

  for line in s1:
    json_data = json.loads(line)

    cur.execute('INSERT OR IGNORE INTO cards VALUES (?, ?)',
                (json_data['ID'], json_data['NAME']))

  conn.commit()
  conn.close()

jsonl_file_path = 'cardlist_S2.jsonl'
jsonl_file_path = 'cardlist_S2.jsonl'
jsonl_file_path = 'cardlist_S2.jsonl'

good_and_gather('cardlist_S1.jsonl')
good_and_gather('cardlist_S2.jsonl')
good_and_gather('cardlist_S3.jsonl')