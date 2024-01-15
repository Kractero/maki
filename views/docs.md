Bazaar is a backend and frontend wrapper to a database containing all trade records since the start of the nationStates trading card minigame in 2018.

The purpose of Bazaar is to provide a comprehensive platform for managing and retrieving trade records.

<a href="https://github.com/kractero/bazaar/" target="_blank" rel="noreferrer noopener">Repo</a>

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
    - `sortorder`: Sorting order (`asc` or `desc`, `desc` defai;t).

  - **Rate Limit:** 50 requests per 30 seconds.

## Frontend

The frontend is served as a page by Express using the EJS templating engine. It leverages htmx for dynamic content updates.

## Anticipated FAQ

1. Why isn't this just in Hare like Legend Tracker?

  - Cause it isn't, I wanted the backend to be independent from Hare. A frontend can be eventually added to Hare.