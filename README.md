# Maki

![Express.js](https://img.shields.io/badge/express.js-%23404d59.svg?style=for-the-badge&logo=express&logoColor=%2361DAFB) ![Docker](https://img.shields.io/badge/docker-%230db7ed.svg?style=for-the-badge&logo=docker&logoColor=white)

Maki is a backend API to interface with a database containing all trade records since the start of the nationStates trading card minigame in 2018.

## DB

The data was generated from a dump that 9003 generated off of data up to October 15th. I wrote some python scripts to push the data into a database, then some scripts to pull the latest data not included in the database. At the moment it updates every `5` minutes.

## API

The API is built with Express and wraps the SQLite database containing trade records. The main endpoint for interacting with trade records is `/api/trades`. This endpoint supports various parameters for filtering, sorting, and limiting the results.

### Get Trades

- **Endpoint:** `/api/trades`
- **Method:** `GET`
- **Description:** Retrieve a list of trade records based on specified parameters.

  - **Parameters:**

    - `buyer`: Filter by buyer name.
    - `seller`: Filter by seller name.
    - `cardid`: Filter by card ID.
    - `category`: Filter by trade category.
    - `minprice`: Filter trades with price greater than or equal to the specified value.
    - `maxprice`: Filter trades with price less than or equal to the specified value.
    - `price`: Filter trades with a specific price.
    - `season`: Filter trades by season.
    - `beforetime`: Filter trades before the specified timestamp.
    - `sincetime`: Filter trades since the specified timestamp.

  - **Optional Parameters:**

    - `limit`: Limit the number of returned results (defaults to 1000).
    - `sortval`: Sort results by `price` or `timestamp`, `timestamp` default.
    - `sortorder`: Sorting order `asc` or `desc`, `desc` default.

  - **Rate Limit:** 50 requests per 30 seconds.
