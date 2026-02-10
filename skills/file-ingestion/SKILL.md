---
name: file-ingestion
description: Securely ingest structured files (CSV, JSON, XML, Excel) into a database with auto-generated schema via LLM. Use when an agent needs to (1) fetch data from a source (local path, URL, Google Drive, S3), (2) infer table schema from file samples using LLM, (3) create database/table dynamically, and (4) load data with type coercion. Supports secure connections (SSL/TLS) to databases over public domains, Redis caching, and full env-based configuration.
---

# File Ingestion Skill

Ingest structured files into a database with LLM-powered schema inference. Supports secure connections to databases over public domains.

## Quick Start

```python
from ingest_file import ingest_file
import os

# All configuration via environment variables
os.environ["DB_HOST"] = "mydb.example.com"
os.environ["DB_PORT"] = "5432"
os.environ["DB_USER"] = "dbuser"
os.environ["DB_PASSWORD"] = "dbpass"
os.environ["DB_NAME"] = "mydb"  # Optional: auto-created if not exists
os.environ["DB_SSL_MODE"] = "require"  # For secure public domain connections

os.environ["LLM_API_BASE"] = "https://api.openai.com/v1"
os.environ["LLM_MODEL"] = "gpt-4"
os.environ["LLM_API_KEY"] = "sk-..."

# Optional: Redis for caching/metadata
os.environ["REDIS_URL"] = "rediss://:pass@redis.example.com:6380"  # rediss = SSL

# Ingest
result = ingest_file(
    source="https://example.com/data.csv",
    table_name="sales_data"  # optional, auto-generated if not provided
)

print(f"Database: {result['database']}")
print(f"Table: {result['table']}")
print(f"Rows: {result['rows_ingested']}")
```

## Environment Configuration

### Database (SQL)

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `DB_TYPE` | No | `postgresql` | Database type: postgresql, mysql, sqlite |
| `DB_HOST` | Yes* | - | Database host (public domain or IP) |
| `DB_PORT` | No | `5432` | Database port |
| `DB_USER` | Yes* | - | Database user |
| `DB_PASSWORD` | Yes* | - | Database password |
| `DB_NAME` | No | Auto | Database name (created if not exists) |
| `DB_SSL_MODE` | No | `prefer` | SSL mode: disable, allow, prefer, require, verify-ca, verify-full |
| `DB_SSL_ROOT_CERT` | No | - | Path to CA cert for SSL verification |
| `DB_SSL_CERT` | No | - | Path to client cert for mutual TLS |
| `DB_SSL_KEY` | No | - | Path to client key for mutual TLS |
| `DB_URL` | Alt | - | Full connection string (overrides above) |

*Required unless using `DB_URL` or SQLite

### Redis (Optional - for caching)

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `REDIS_URL` | No | - | Redis connection URL |
| `REDIS_HOST` | No | `localhost` | Redis host |
| `REDIS_PORT` | No | `6379` | Redis port |
| `REDIS_PASSWORD` | No | - | Redis password |
| `REDIS_SSL` | No | `false` | Use SSL/TLS for Redis |
| `REDIS_DB` | No | `0` | Redis database number |

Use `rediss://` URL scheme for SSL-enabled Redis.

### LLM (Schema Inference)

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `LLM_API_BASE` | Yes | - | LLM API endpoint |
| `LLM_MODEL` | Yes | - | Model name |
| `LLM_API_KEY` | No | - | API key if required |
| `LLM_TIMEOUT` | No | `120` | Request timeout in seconds |

### Ingestion Behavior

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `INGEST_SAMPLE_SIZE` | No | `100` | Records to sample for schema |
| `INGEST_BATCH_SIZE` | No | `1000` | Insert batch size |
| `INGEST_MAX_ERRORS` | No | `100` | Max parsing errors before stopping |
| `INGEST_SKIP_MALFORMED` | No | `true` | Skip bad rows vs fail |

## Secure Public Domain Connections

### PostgreSQL with SSL

```bash
# Basic SSL
export DB_HOST="mydb.postgres.database.azure.com"
export DB_SSL_MODE="require"

# With certificate verification
export DB_SSL_MODE="verify-full"
export DB_SSL_ROOT_CERT="/path/to/ca-cert.pem"

# Mutual TLS (client cert auth)
export DB_SSL_CERT="/path/to/client-cert.pem"
export DB_SSL_KEY="/path/to/client-key.pem"
```

### Redis with SSL

```bash
# Using URL (rediss = SSL)
export REDIS_URL="rediss://:password@redis.example.com:6380/0"

# Or separate vars
export REDIS_HOST="redis.example.com"
export REDIS_PORT="6380"
export REDIS_PASSWORD="secret"
export REDIS_SSL="true"
```

### Cloud Examples

**AWS RDS PostgreSQL:**
```bash
export DB_HOST="mydb.abc123.us-east-1.rds.amazonaws.com"
export DB_USER="admin"
export DB_PASSWORD="..."
export DB_SSL_MODE="require"
export DB_SSL_ROOT_CERT="./rds-ca-2019-root.pem"
```

**Azure Database for PostgreSQL:**
```bash
export DB_HOST="mydb.postgres.database.azure.com"
export DB_USER="myuser@mydb"
export DB_PASSWORD="..."
export DB_SSL_MODE="require"
```

**Google Cloud SQL:**
```bash
export DB_HOST="34.123.45.67"  # Public IP
export DB_USER="postgres"
export DB_PASSWORD="..."
export DB_SSL_MODE="verify-ca"
export DB_SSL_ROOT_CERT="./server-ca.pem"
export DB_SSL_CERT="./client-cert.pem"
export DB_SSL_KEY="./client-key.pem"
```

## Database Auto-Creation

If `DB_NAME` is not provided or the database doesn't exist, the skill will:

1. Connect to the default `postgres`/`mysql` database
2. Create the requested database with a generated name: `ingestion_{timestamp}`
3. Create the table within that database

Example auto-created names:
- `ingestion_20240205_143022`
- `ingestion_20240205_143045`

## Supported Sources

| Source | Example | Notes |
|--------|---------|-------|
| Local file | `./data/sales.csv` | Relative or absolute path |
| HTTP/HTTPS | `https://api.example.com/data.json` | Supports redirects, auth headers |
| S3 | `s3://bucket/path/file.csv` | Uses AWS credentials |
| Google Drive | `gdrive://FILE_ID` | File ID from share URL |
| GDrive URL | `https://drive.google.com/file/d/FILE_ID/view` | Auto-detects file ID |

## Usage Examples

### Python API - Full Control

```python
from ingest_file import ingest_file
import os

# Secure DB connection to cloud PostgreSQL
os.environ["DB_HOST"] = "mydb.postgres.database.azure.com"
os.environ["DB_PORT"] = "5432"
os.environ["DB_USER"] = "myuser@mydb"
os.environ["DB_PASSWORD"] = "secure-password"
os.environ["DB_SSL_MODE"] = "require"
os.environ["DB_NAME"] = "analytics"  # Created if not exists

# LLM configuration
os.environ["LLM_API_BASE"] = "https://api.openai.com/v1"
os.environ["LLM_MODEL"] = "gpt-4"
os.environ["LLM_API_KEY"] = os.getenv("OPENAI_API_KEY")

# Redis for caching (SSL enabled)
os.environ["REDIS_URL"] = "rediss://:pass@cache.example.com:6380"

# Ingest from any source
result = ingest_file(
    source="s3://bucket/transactions.csv",
    table_name="transactions"  # Optional: auto-generated if not provided
)

print(f"Database: {result['database']}")
print(f"Table: {result['table']}")
print(f"Schema entity: {result['schema']['entity']}")
print(f"Rows ingested: {result['rows_ingested']}")
print(f"Errors: {result['total_errors']}")
print(f"Duration: {result['duration_seconds']}s")
```

### Python API - Minimal Setup (Auto-Create DB)

```python
from ingest_file import ingest_file
import os

# Minimal config - database will be auto-created
os.environ["DB_HOST"] = "db.example.com"
os.environ["DB_USER"] = "admin"
os.environ["DB_PASSWORD"] = "secret"
os.environ["DB_SSL_MODE"] = "require"

os.environ["LLM_API_BASE"] = "http://localhost:11434/v1"
os.environ["LLM_MODEL"] = "qwen2.5-coder:14b"

# Don't set DB_NAME - it will be auto-created
result = ingest_file("https://api.example.com/data.json")

print(f"Auto-created database: {result['database']}")
print(f"Created table: {result['table']}")
```

### CLI Usage

```bash
# Set env vars for secure cloud connection
export DB_HOST="mydb.postgres.database.azure.com"
export DB_USER="admin"
export DB_PASSWORD="secret"
export DB_SSL_MODE="require"
export DB_NAME="production"  # Optional

export LLM_API_BASE="https://api.openai.com/v1"
export LLM_MODEL="gpt-4"
export LLM_API_KEY="sk-..."

# Optional: Redis cache
export REDIS_URL="rediss://:pass@redis.example.com:6380"

# Run ingestion
python ingest_file.py "https://example.com/data.csv" "my_table"

# Or auto-generate table name
python ingest_file.py "./local_data.json"
```

## Result Structure

```json
{
  "database": "analytics",
  "table": "transactions_20240205_143022",
  "schema": {
    "entity": "transactions",
    "description": "Sales transaction records",
    "fields": [
      {
        "name": "id",
        "type": "integer",
        "description": "Unique transaction identifier",
        "nullable": false
      },
      {
        "name": "amount",
        "type": "float",
        "description": "Transaction amount in USD",
        "nullable": false
      }
    ]
  },
  "rows_ingested": 15420,
  "total_errors": 3,
  "errors": [
    {"row": 523, "field": "amount", "value": "N/A", "error": "..."}
  ],
  "duration_seconds": 12.5,
  "cached": false
}
```

## Requirements

```bash
# Core
pip install requests

# Databases (pick one or more)
pip install psycopg2-binary  # PostgreSQL
pip install pymysql          # MySQL
# SQLite is built-in

# Redis (optional, for caching)
pip install redis

# File formats
pip install pandas openpyxl  # Excel support
```
