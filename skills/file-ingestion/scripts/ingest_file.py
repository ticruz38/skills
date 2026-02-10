#!/usr/bin/env python3
"""Secure file ingestion with LLM-powered schema inference.

Supports:
- Secure database connections (SSL/TLS) over public domains
- Redis caching with SSL
- Auto-creation of databases and tables
- Multiple source types (local, HTTP, S3, Google Drive)

Usage:
    python ingest_file.py <source> [table_name]
    
Environment:
    DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME
    DB_SSL_MODE, DB_SSL_ROOT_CERT, DB_SSL_CERT, DB_SSL_KEY
    REDIS_URL or REDIS_HOST, REDIS_PORT, REDIS_PASSWORD, REDIS_SSL
    LLM_API_BASE, LLM_MODEL, LLM_API_KEY
"""

import json
import logging
import os
import re
import ssl
import sys
import tempfile
import uuid
from datetime import datetime
from pathlib import Path
from typing import Any, Optional, Tuple
from urllib.parse import urlparse

import requests

logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")
logger = logging.getLogger(__name__)


# ============================================================================
# Environment Configuration
# ============================================================================

def get_env(key: str, default: str = None, required: bool = False) -> Optional[str]:
    """Get environment variable with optional default and required check."""
    value = os.getenv(key, default)
    if required and not value:
        raise ValueError(f"Environment variable {key} is required")
    return value


def get_env_bool(key: str, default: bool = False) -> bool:
    """Get boolean environment variable."""
    value = os.getenv(key, str(default).lower())
    return value.lower() in ("true", "1", "yes", "on")


def get_env_int(key: str, default: int = 0) -> int:
    """Get integer environment variable."""
    return int(os.getenv(key, default))


# ============================================================================
# Redis Connection (with SSL support)
# ============================================================================

def get_redis_client():
    """Get Redis client with SSL support if configured."""
    try:
        import redis
    except ImportError:
        logger.debug("Redis not installed, skipping cache")
        return None
    
    redis_url = get_env("REDIS_URL")
    
    if redis_url:
        # Parse URL for SSL
        parsed = urlparse(redis_url)
        use_ssl = parsed.scheme == "rediss"
        
        try:
            client = redis.from_url(
                redis_url,
                ssl_cert_reqs=ssl.CERT_REQUIRED if use_ssl else None,
                decode_responses=True
            )
            client.ping()
            logger.info(f"Redis connected (SSL={use_ssl})")
            return client
        except Exception as e:
            logger.warning(f"Redis connection failed: {e}")
            return None
    
    # Build from separate env vars
    host = get_env("REDIS_HOST", "localhost")
    port = get_env_int("REDIS_PORT", 6379)
    password = get_env("REDIS_PASSWORD")
    use_ssl = get_env_bool("REDIS_SSL")
    db = get_env_int("REDIS_DB", 0)
    
    try:
        client = redis.Redis(
            host=host,
            port=port,
            password=password,
            db=db,
            ssl=use_ssl,
            ssl_cert_reqs=ssl.CERT_REQUIRED if use_ssl else None,
            decode_responses=True
        )
        client.ping()
        logger.info(f"Redis connected to {host}:{port} (SSL={use_ssl})")
        return client
    except Exception as e:
        logger.warning(f"Redis connection failed: {e}")
        return None


def cache_key(source: str, prefix: str = "ingest") -> str:
    """Generate cache key for a source."""
    import hashlib
    source_hash = hashlib.md5(source.encode()).hexdigest()[:12]
    return f"{prefix}:{source_hash}"


# ============================================================================
# Database Connection (with SSL support)
# ============================================================================

class DatabaseConnection:
    """Database connection manager with SSL and auto-creation support."""
    
    def __init__(self):
        self.db_type = get_env("DB_TYPE", "postgresql")
        self.conn = None
        self.target_db = None
    
    def _build_connection_params(self, db_name: str = None) -> dict:
        """Build connection parameters with SSL."""
        params = {}
        
        # Check for full URL
        db_url = get_env("DB_URL")
        if db_url:
            params["dsn"] = db_url
            return params
        
        # Build from components
        if self.db_type == "sqlite":
            params["database"] = db_name or get_env("DB_NAME", "ingestion.db")
            return params
        
        # PostgreSQL / MySQL
        params["host"] = get_env("DB_HOST", required=True)
        params["port"] = get_env_int("DB_PORT", 5432 if self.db_type == "postgresql" else 3306)
        params["user"] = get_env("DB_USER", required=True)
        params["password"] = get_env("DB_PASSWORD", required=True)
        params["database"] = db_name or get_env("DB_NAME", "postgres" if self.db_type == "postgresql" else "mysql")
        
        # SSL Configuration
        ssl_mode = get_env("DB_SSL_MODE", "prefer")
        
        if ssl_mode in ("require", "verify-ca", "verify-full"):
            # Setup SSL context
            ssl_context = ssl.create_default_context()
            
            # Custom CA cert
            ca_cert = get_env("DB_SSL_ROOT_CERT")
            if ca_cert and Path(ca_cert).exists():
                ssl_context.load_verify_locations(ca_cert)
            
            # Client cert for mutual TLS
            client_cert = get_env("DB_SSL_CERT")
            client_key = get_env("DB_SSL_KEY")
            if client_cert and client_key and Path(client_cert).exists() and Path(client_key).exists():
                ssl_context.load_cert_chain(client_cert, client_key)
            
            if self.db_type == "postgresql":
                import psycopg2
                params["sslmode"] = ssl_mode
                if ca_cert:
                    params["sslrootcert"] = ca_cert
                if client_cert:
                    params["sslcert"] = client_cert
                if client_key:
                    params["sslkey"] = client_key
            elif self.db_type == "mysql":
                params["ssl"] = ssl_context
        
        return params
    
    def connect(self, db_name: str = None):
        """Connect to database."""
        if self.db_type == "postgresql":
            import psycopg2
            params = self._build_connection_params(db_name)
            self.conn = psycopg2.connect(**params)
            self.conn.autocommit = True
        elif self.db_type == "mysql":
            import pymysql
            params = self._build_connection_params(db_name)
            self.conn = pymysql.connect(**params)
        elif self.db_type == "sqlite":
            import sqlite3
            params = self._build_connection_params(db_name)
            self.conn = sqlite3.connect(params["database"])
            self.conn.row_factory = sqlite3.Row
        else:
            raise ValueError(f"Unsupported database type: {self.db_type}")
        
        return self.conn
    
    def database_exists(self, db_name: str) -> bool:
        """Check if database exists."""
        if self.db_type == "sqlite":
            return True  # SQLite creates on connect
        
        cursor = self.conn.cursor()
        try:
            if self.db_type == "postgresql":
                cursor.execute("SELECT 1 FROM pg_database WHERE datname = %s", (db_name,))
            elif self.db_type == "mysql":
                cursor.execute("SELECT 1 FROM information_schema.schemata WHERE schema_name = %s", (db_name,))
            return cursor.fetchone() is not None
        finally:
            cursor.close()
    
    def create_database(self, db_name: str):
        """Create database if not exists."""
        if self.db_type == "sqlite":
            return  # Auto-created on connect
        
        if self.database_exists(db_name):
            logger.info(f"Database exists: {db_name}")
            return
        
        cursor = self.conn.cursor()
        try:
            # Sanitize database name (prevent SQL injection)
            safe_name = re.sub(r'[^a-zA-Z0-9_]', '', db_name)
            if not safe_name:
                raise ValueError(f"Invalid database name: {db_name}")
            
            logger.info(f"Creating database: {safe_name}")
            
            if self.db_type == "postgresql":
                cursor.execute(f'CREATE DATABASE "{safe_name}"')
            elif self.db_type == "mysql":
                cursor.execute(f"CREATE DATABASE IF NOT EXISTS `{safe_name}`")
            
            self.conn.commit()
            logger.info(f"Database created: {safe_name}")
        finally:
            cursor.close()
    
    def close(self):
        """Close connection."""
        if self.conn:
            self.conn.close()
            self.conn = None


def get_db_connection(db_name: str = None) -> Tuple[Any, str, str]:
    """Get database connection and info.
    
    Returns:
        Tuple of (connection, db_type, actual_db_name)
    """
    db = DatabaseConnection()
    target_db = db_name or get_env("DB_NAME")
    
    # Connect to default DB first (for creating target DB)
    if db.db_type in ("postgresql", "mysql") and target_db:
        default_db = "postgres" if db.db_type == "postgresql" else "mysql"
        db.connect(default_db)
        
        if not db.database_exists(target_db):
            # Generate name if not provided
            if not get_env("DB_NAME"):
                timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
                target_db = f"ingestion_{timestamp}"
            
            db.create_database(target_db)
        
        db.close()
    
    # Connect to target database
    db.connect(target_db)
    
    return db.conn, db.db_type, target_db or "main"


# ============================================================================
# Schema to SQL Type Mapping
# ============================================================================

def sql_type(field_type: str, db_type: str) -> str:
    """Map schema type to SQL type."""
    mapping = {
        ("string", "postgresql"): "TEXT",
        ("string", "mysql"): "VARCHAR(255)",
        ("string", "sqlite"): "TEXT",
        ("integer", "postgresql"): "INTEGER",
        ("integer", "mysql"): "INT",
        ("integer", "sqlite"): "INTEGER",
        ("float", "postgresql"): "DOUBLE PRECISION",
        ("float", "mysql"): "DOUBLE",
        ("float", "sqlite"): "REAL",
        ("date", "postgresql"): "TIMESTAMP",
        ("date", "mysql"): "DATETIME",
        ("date", "sqlite"): "TEXT",
        ("boolean", "postgresql"): "BOOLEAN",
        ("boolean", "mysql"): "BOOLEAN",
        ("boolean", "sqlite"): "INTEGER",
    }
    return mapping.get((field_type, db_type), "TEXT")


# ============================================================================
# File Fetching
# ============================================================================

def fetch_file(source: str) -> Tuple[bytes, str]:
    """Fetch file from various sources. Returns (content, filename)."""
    parsed = urlparse(source)
    
    # HTTP/HTTPS
    if parsed.scheme in ("http", "https"):
        logger.info(f"Downloading from URL: {source}")
        resp = requests.get(source, timeout=60)
        resp.raise_for_status()
        cd = resp.headers.get("Content-Disposition", "")
        match = re.search(r'filename="?([^"]+)"?', cd)
        filename = match.group(1) if match else Path(parsed.path).name or "download"
        return resp.content, filename
    
    # S3
    if parsed.scheme == "s3":
        import boto3
        logger.info(f"Downloading from S3: {source}")
        s3 = boto3.client("s3")
        bucket = parsed.netloc
        key = parsed.path.lstrip("/")
        with tempfile.NamedTemporaryFile(delete=False) as tmp:
            s3.download_fileobj(bucket, key, tmp)
            tmp_path = tmp.name
        content = Path(tmp_path).read_bytes()
        Path(tmp_path).unlink()
        return content, Path(key).name
    
    # Google Drive
    if parsed.scheme == "gdrive" or "drive.google.com" in source:
        file_id = parsed.netloc if parsed.scheme == "gdrive" else _extract_gdrive_id(source)
        logger.info(f"Downloading from Google Drive: {file_id}")
        url = f"https://drive.google.com/uc?export=download&id={file_id}"
        resp = requests.get(url, timeout=60)
        resp.raise_for_status()
        return resp.content, f"gdrive_{file_id}"
    
    # Local file
    logger.info(f"Reading local file: {source}")
    path = Path(source)
    if not path.exists():
        raise FileNotFoundError(f"File not found: {source}")
    return path.read_bytes(), path.name


def _extract_gdrive_id(url: str) -> str:
    """Extract file ID from Google Drive URL."""
    patterns = [
        r"/d/([a-zA-Z0-9_-]+)",
        r"id=([a-zA-Z0-9_-]+)",
        r"open\?id=([a-zA-Z0-9_-]+)",
    ]
    for pattern in patterns:
        match = re.search(pattern, url)
        if match:
            return match.group(1)
    raise ValueError(f"Could not extract Google Drive file ID from: {url}")


def detect_format(filename: str) -> str:
    """Detect file format from extension."""
    ext = Path(filename).suffix.lower()
    formats = {
        ".csv": "csv",
        ".json": "json",
        ".jsonl": "jsonl",
        ".xml": "xml",
        ".xlsx": "excel",
        ".xls": "excel",
    }
    fmt = formats.get(ext)
    if not fmt:
        raise ValueError(f"Unknown file format: {ext}")
    return fmt


# ============================================================================
# File Parsing
# ============================================================================

def parse_sample(content: bytes, fmt: str, max_records: int = 100) -> Tuple[list[dict], dict]:
    """Parse sample records and return with field metadata."""
    if fmt == "csv":
        return _parse_csv_sample(content, max_records)
    elif fmt == "json":
        return _parse_json_sample(content, max_records)
    elif fmt == "jsonl":
        return _parse_jsonl_sample(content, max_records)
    elif fmt == "xml":
        return _parse_xml_sample(content, max_records)
    elif fmt == "excel":
        return _parse_excel_sample(content, max_records)
    else:
        raise ValueError(f"Unsupported format: {fmt}")


def _parse_csv_sample(content: bytes, max_records: int) -> Tuple[list[dict], dict]:
    import csv
    import io
    
    text = content.decode("utf-8", errors="replace")
    reader = csv.DictReader(io.StringIO(text))
    records = []
    for i, row in enumerate(reader):
        if i >= max_records:
            break
        records.append({k: v for k, v in row.items() if k is not None})
    
    field_defs = {k: {"sample_values": [r.get(k) for r in records[:5] if r.get(k)]}
                 for k in records[0].keys()} if records else {}
    return records, field_defs


def _parse_json_sample(content: bytes, max_records: int) -> Tuple[list[dict], dict]:
    data = json.loads(content)
    if isinstance(data, list):
        records = data[:max_records]
    elif isinstance(data, dict):
        for v in data.values():
            if isinstance(v, list) and v:
                records = v[:max_records]
                break
        else:
            records = [data]
    else:
        raise ValueError("JSON must contain an object or array")
    
    field_defs = {k: {"sample_values": [r.get(k) for r in records[:5] if r.get(k)]}
                 for k in records[0].keys()} if records else {}
    return records, field_defs


def _parse_jsonl_sample(content: bytes, max_records: int) -> Tuple[list[dict], dict]:
    records = []
    for line in content.decode("utf-8", errors="replace").strip().split("\n")[:max_records]:
        if line.strip():
            records.append(json.loads(line))
    
    field_defs = {k: {"sample_values": [r.get(k) for r in records[:5] if r.get(k)]}
                 for k in records[0].keys()} if records else {}
    return records, field_defs


def _parse_xml_sample(content: bytes, max_records: int) -> Tuple[list[dict], dict]:
    import xml.etree.ElementTree as ET
    
    root = ET.fromstring(content)
    records = []
    children = list(root)
    if not children:
        return [], {}
    
    tag_name = children[0].tag
    for child in children[:max_records]:
        if child.tag == tag_name:
            record = {}
            for elem in child:
                record[elem.tag] = elem.text or ""
                for attr, val in elem.attrib.items():
                    record[f"{elem.tag}_{attr}"] = val
            records.append(record)
    
    field_defs = {k: {"sample_values": [r.get(k) for r in records[:5] if r.get(k)]}
                 for k in records[0].keys()} if records else {}
    return records, field_defs


def _parse_excel_sample(content: bytes, max_records: int) -> Tuple[list[dict], dict]:
    import pandas as pd
    import io
    
    df = pd.read_excel(io.BytesIO(content), nrows=max_records)
    records = df.fillna("").to_dict("records")
    
    field_defs = {k: {"sample_values": [r.get(k) for r in records[:5] if r.get(k)]}
                 for k in records[0].keys()} if records else {}
    return records, field_defs


# ============================================================================
# LLM Schema Inference
# ============================================================================

def infer_schema(records: list[dict], field_defs: dict, filename: str, fmt: str) -> dict:
    """Use LLM to infer schema from sample records."""
    api_base = get_env("LLM_API_BASE", required=True)
    model = get_env("LLM_MODEL", required=True)
    api_key = get_env("LLM_API_KEY", "")
    timeout = get_env_int("LLM_TIMEOUT", 120)
    
    system_prompt = """You are a schema inference agent. Analyze sample records and propose a database table schema.

Rules:
- Field types: string, integer, float, date, boolean
- Use 'date' for ISO dates, timestamps, or date strings
- Use 'float' for decimal numbers, percentages, money
- Use 'integer' for whole numbers, counts, IDs
- Mark nullable=true if you see NULL, empty strings, or missing values
- Entity name should be singular, lowercase_with_underscores
- Description should explain what the data represents

Output ONLY valid JSON:
{
  "entity": "table_name",
  "description": "What this data represents",
  "fields": [
    {"name": "field_name", "type": "string|integer|float|date|boolean", "description": "...", "nullable": true|false}
  ]
}"""

    user_msg = {
        "file_name": filename,
        "format": fmt,
        "sample_count": len(records),
        "samples": records[:10],
        "field_hints": list(field_defs.keys())[:20]
    }
    
    logger.info(f"Calling LLM ({model}) for schema inference...")
    
    headers = {"Content-Type": "application/json"}
    if api_key:
        headers["Authorization"] = f"Bearer {api_key}"
    
    resp = requests.post(
        f"{api_base}/chat/completions",
        headers=headers,
        json={
            "model": model,
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": json.dumps(user_msg)}
            ],
            "temperature": 0.0
        },
        timeout=timeout
    )
    resp.raise_for_status()
    
    content = resp.json()["choices"][0]["message"]["content"]
    
    try:
        schema = json.loads(content)
    except json.JSONDecodeError:
        match = re.search(r'\{.*\}', content, re.DOTALL)
        if match:
            schema = json.loads(match.group())
        else:
            raise ValueError(f"Could not parse schema from LLM response: {content[:200]}")
    
    required = ["entity", "description", "fields"]
    for key in required:
        if key not in schema:
            raise ValueError(f"Schema missing required key: {key}")
    
    logger.info(f"Inferred schema: {schema['entity']} with {len(schema['fields'])} fields")
    return schema


# ============================================================================
# Database Operations
# ============================================================================

def create_table(conn, db_type: str, table_name: str, schema: dict):
    """Create table from schema."""
    cursor = conn.cursor()
    
    try:
        cursor.execute(f'DROP TABLE IF EXISTS "{table_name}"')
        
        columns = ['"id" SERIAL PRIMARY KEY' if db_type == "postgresql" else '"id" INTEGER PRIMARY KEY AUTOINCREMENT']
        
        for field in schema["fields"]:
            col_type = sql_type(field["type"], db_type)
            nullable = "" if field.get("nullable", True) else "NOT NULL"
            columns.append(f'"{field["name"]}" {col_type} {nullable}'.strip())
        
        columns.append('"_ingested_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP')
        columns.append('"_source" TEXT')
        
        columns_str = ", ".join(columns)
        sql = f'CREATE TABLE "{table_name}" ({columns_str})'
        logger.info(f"Creating table: {table_name}")
        cursor.execute(sql)
        conn.commit()
    finally:
        cursor.close()


def coerce_value(value: Any, field_type: str) -> Tuple[Any, Optional[str]]:
    """Coerce value to field type. Returns (coerced_value, error)."""
    if value is None or value == "":
        return None, None
    
    try:
        if field_type == "string":
            return str(value), None
        elif field_type == "integer":
            if isinstance(value, str):
                value = value.replace(",", "").strip()
            return int(float(value)), None
        elif field_type == "float":
            if isinstance(value, str):
                value = value.replace(",", "").strip()
            return float(value), None
        elif field_type == "boolean":
            if isinstance(value, str):
                return value.lower() in ("true", "1", "yes", "y"), None
            return bool(value), None
        elif field_type == "date":
            return str(value), None
        else:
            return str(value), None
    except Exception as e:
        return None, str(e)


def parse_and_insert(conn, db_type: str, table_name: str, content: bytes, fmt: str, 
                     schema: dict, source: str, redis_client=None) -> Tuple[int, list]:
    """Parse full file and insert rows."""
    batch_size = get_env_int("INGEST_BATCH_SIZE", 1000)
    max_errors = get_env_int("INGEST_MAX_ERRORS", 100)
    skip_malformed = get_env_bool("INGEST_SKIP_MALFORMED", True)
    
    cursor = conn.cursor()
    fields = [f["name"] for f in schema["fields"]]
    field_types = {f["name"]: f["type"] for f in schema["fields"]}
    
    rows_inserted = 0
    errors = []
    
    # Get all records
    all_records = _get_all_records(content, fmt)
    
    # Prepare SQL
    placeholders = ", ".join(["%s"] * (len(fields) + 2))
    columns = ", ".join([f'"{f}"' for f in fields] + ['"_source"'])
    sql = f'INSERT INTO "{table_name}" ({columns}) VALUES ({placeholders})'
    
    if db_type == "sqlite":
        sql = sql.replace("%s", "?")
    
    batch = []
    
    for i, record in enumerate(all_records, 1):
        row_errors = []
        row_data = []
        
        for field_name in fields:
            raw_value = record.get(field_name)
            field_type = field_types.get(field_name, "string")
            coerced, error = coerce_value(raw_value, field_type)
            
            if error:
                row_errors.append({"row": i, "field": field_name, "value": raw_value, "error": error})
            
            row_data.append(coerced)
        
        row_data.append(source)
        
        if row_errors:
            errors.extend(row_errors)
            if len(errors) > max_errors:
                if not skip_malformed:
                    raise ValueError(f"Max errors exceeded: {len(errors)}")
                logger.warning(f"Max errors exceeded, stopping")
                break
            if not skip_malformed:
                continue
        
        batch.append(tuple(row_data))
        
        if len(batch) >= batch_size:
            cursor.executemany(sql, batch)
            conn.commit()
            rows_inserted += len(batch)
            logger.info(f"Inserted {rows_inserted} rows...")
            batch = []
    
    if batch:
        cursor.executemany(sql, batch)
        conn.commit()
        rows_inserted += len(batch)
    
    cursor.close()
    return rows_inserted, errors


def _get_all_records(content: bytes, fmt: str) -> list[dict]:
    """Parse all records from content."""
    if fmt == "csv":
        import csv
        import io
        reader = csv.DictReader(io.StringIO(content.decode("utf-8", errors="replace")))
        return list(reader)
    elif fmt == "json":
        data = json.loads(content)
        if isinstance(data, list):
            return data
        elif isinstance(data, dict):
            for v in data.values():
                if isinstance(v, list):
                    return v
            return [data]
    elif fmt == "jsonl":
        return [json.loads(line) for line in content.decode("utf-8", errors="replace").strip().split("\n") if line.strip()]
    elif fmt == "xml":
        import xml.etree.ElementTree as ET
        root = ET.fromstring(content)
        tag_name = list(root)[0].tag if list(root) else None
        records = []
        for child in root:
            if child.tag == tag_name:
                record = {}
                for elem in child:
                    record[elem.tag] = elem.text or ""
                    for attr, val in elem.attrib.items():
                        record[f"{elem.tag}_{attr}"] = val
                records.append(record)
        return records
    elif fmt == "excel":
        import pandas as pd
        import io
        df = pd.read_excel(io.BytesIO(content))
        return df.fillna("").to_dict("records")
    else:
        raise ValueError(f"Unsupported format: {fmt}")


# ============================================================================
# Main Entry Point
# ============================================================================

def ingest_file(source: str, table_name: str = None, db_name: str = None) -> dict:
    """Ingest a file from source into database.
    
    Args:
        source: File source (path, URL, s3://, gdrive://)
        table_name: Target table name (auto-generated if None)
        db_name: Target database name (auto-created if None)
    
    Returns:
        dict with keys: database, table, schema, rows_ingested, errors, duration_seconds
    """
    start_time = datetime.now()
    
    # Check Redis cache
    redis_client = get_redis_client()
    cache_k = cache_key(source)
    
    if redis_client:
        cached = redis_client.get(f"{cache_k}:result")
        if cached:
            logger.info("Returning cached result")
            result = json.loads(cached)
            result["cached"] = True
            return result
    
    # Fetch file
    content, filename = fetch_file(source)
    fmt = detect_format(filename)
    logger.info(f"Detected format: {fmt}, size: {len(content)} bytes")
    
    # Parse sample for schema
    sample_size = get_env_int("INGEST_SAMPLE_SIZE", 100)
    sample_records, field_defs = parse_sample(content, fmt, sample_size)
    logger.info(f"Parsed {len(sample_records)} sample records")
    
    if not sample_records:
        raise ValueError("No records found in file")
    
    # Infer schema
    schema = infer_schema(sample_records, field_defs, filename, fmt)
    
    # Generate names if not provided
    if not table_name:
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        table_name = f"{schema['entity']}_{timestamp}"
    
    if not db_name:
        db_name = get_env("DB_NAME")
    
    # Connect to DB (auto-creates if needed)
    conn, db_type, actual_db_name = get_db_connection(db_name)
    
    try:
        create_table(conn, db_type, table_name, schema)
        
        rows_inserted, errors = parse_and_insert(
            conn, db_type, table_name, content, fmt, schema, source, redis_client
        )
        
        duration = (datetime.now() - start_time).total_seconds()
        
        result = {
            "database": actual_db_name,
            "table": table_name,
            "schema": schema,
            "rows_ingested": rows_inserted,
            "errors": errors[:10],
            "total_errors": len(errors),
            "duration_seconds": round(duration, 2),
            "cached": False
        }
        
        # Cache result in Redis
        if redis_client:
            redis_client.setex(
                f"{cache_k}:result",
                3600,  # 1 hour TTL
                json.dumps(result)
            )
            redis_client.setex(
                f"{cache_k}:schema",
                86400,  # 24 hour TTL
                json.dumps(schema)
            )
        
        logger.info(f"Ingestion complete: {actual_db_name}.{table_name} - {rows_inserted} rows in {duration:.1f}s")
        return result
        
    finally:
        conn.close()


def main():
    """CLI entry point."""
    if len(sys.argv) < 2:
        print("Usage: python ingest_file.py <source> [table_name]")
        print("\nEnvironment variables:")
        print("  DB_HOST, DB_PORT, DB_USER, DB_PASSWORD - Database connection")
        print("  DB_SSL_MODE - SSL mode (disable, allow, prefer, require, verify-ca, verify-full)")
        print("  DB_SSL_ROOT_CERT - Path to CA certificate")
        print("  DB_NAME - Database name (auto-created if not exists)")
        print("  REDIS_URL - Redis connection (rediss:// for SSL)")
        print("  LLM_API_BASE, LLM_MODEL, LLM_API_KEY - LLM configuration")
        sys.exit(1)
    
    source = sys.argv[1]
    table_name = sys.argv[2] if len(sys.argv) > 2 else None
    
    result = ingest_file(source, table_name)
    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()
