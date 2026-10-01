# Orders Ingestion Service

A Node.js backend that accepts a CSV file of orders, stores it in Google Cloud Storage (GCS) using Application Default Credentials (ADC), streams it back, validates it row by row, and saves the valid rows into a **sharded PostgreSQL setup** using batch inserts and transactions.

**Stack:** Node.js (ES modules), Express, busboy, csv-parse, pg, pino, PostgreSQL 16 (Docker), Google Cloud Storage.

---


Memory stays roughly constant for any file size: only small stream chunks and at most `BATCH_SIZE` rows per shard are held in memory. The CSV is consumed with `for await`, so while the database is busy no new rows are read (backpressure).

---

## Project structure

```
.
├── docker-compose.yml          3 PostgreSQL shards + GCS emulator
├── sql/schema.sql              SQL schema (applied automatically to every shard)
├── .env.example                Environment variables (no secrets)
├── samples/
│   ├── generate.js             Generates a test CSV (default 10,000 rows, with some bad rows)
│   └── orders.csv              Sample file
└── src/
    ├── server.js               Express app, /health, graceful shutdown
    ├── config/index.js         Reads environment variables
    ├── routes/                 URL -> controller mapping
    ├── controllers/            HTTP layer (upload handling, status codes)
    ├── services/
    │   ├── storage.service.js  GCS upload and read streams (ADC)
    │   └── ingestion.service.js  CSV stream -> validate -> route -> buffer -> batch insert
    ├── db/
    │   ├── shardPools.js       One connection pool per shard
    │   ├── shardRouter.js      Shard selection (stable hash)
    │   └── ordersRepository.js The only file with SQL (transactional batch insert)
    └── utils/
        ├── validator.js        Row validation and cleaning
        └── logger.js           pino logger
```

Separation of concerns: controllers handle HTTP only, services hold the logic, and the repository is the only place that contains SQL.

---

## Prerequisites

- Node.js 20 or newer
- Docker Desktop (running)
- Google Cloud CLI (`gcloud`) only if you want to use a real GCS bucket

---

## Setup and run

```bash
# 1. Install dependencies
npm install

# 2. Create your environment file
cp .env.example .env

# 3. Start the 3 PostgreSQL shards (and the GCS emulator)
docker compose up -d
docker compose ps          # all containers should be "Up"

# 4. Configure Google access (see the next section) OR use the emulator

# 5. Start the API
npm start
```

The `orders` table is created automatically in every shard on the first start of the containers, from `sql/schema.sql`.

### Environment variables (`.env.example`)

| Variable | Meaning |
|---|---|
| `PORT` | API port (default 3000) |
| `BATCH_SIZE` | Rows per insert batch per shard (default 500) |
| `SHARD_URLS` | Comma-separated PostgreSQL connection strings. Their order is the shard number (0, 1, 2) |
| `GCP_PROJECT_ID` | Google Cloud project ID (not secret) |
| `GCS_BUCKET_NAME` | Bucket name (not secret) |
| `STORAGE_EMULATOR_HOST` | Optional. Set it to use the local emulator instead of real GCS |

No credentials are stored in the repository or in `.env`.

### Port conflicts

Host ports are 5436, 5434 and 5435 for the shards and 4443 for the emulator. If a port is already used on your machine, change the left number in `docker-compose.yml` and update `SHARD_URLS` in `.env`.

---


