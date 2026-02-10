#!/usr/bin/env python3
"""Example: Agent using the file-ingestion skill with secure connections."""

import os
from ingest_file import ingest_file


def example_cloud_postgres():
    """Example: Secure connection to cloud PostgreSQL."""
    print("=" * 60)
    print("Example 1: Secure PostgreSQL on Azure")
    print("=" * 60)
    
    # Azure Database for PostgreSQL
    os.environ["DB_HOST"] = "mydb.postgres.database.azure.com"
    os.environ["DB_PORT"] = "5432"
    os.environ["DB_USER"] = "myuser@mydb"
    os.environ["DB_PASSWORD"] = "secure-password"
    os.environ["DB_SSL_MODE"] = "require"
    os.environ["DB_NAME"] = "production"  # Created if not exists
    
    # LLM (OpenAI)
    os.environ["LLM_API_BASE"] = "https://api.openai.com/v1"
    os.environ["LLM_MODEL"] = "gpt-4"
    os.environ["LLM_API_KEY"] = os.getenv("OPENAI_API_KEY", "")
    
    # Redis with SSL for caching
    os.environ["REDIS_URL"] = "rediss://:password@redis.example.com:6380"
    
    # Ingest
    # result = ingest_file(
    #     source="s3://bucket/transactions.csv",
    #     table_name="transactions"
    # )
    
    print("(Uncomment to run with real credentials)")


def example_auto_create_db():
    """Example: Auto-create database and table."""
    print("\n" + "=" * 60)
    print("Example 2: Auto-Create Database")
    print("=" * 60)
    
    # Only provide host/credentials - DB will be auto-created
    os.environ["DB_HOST"] = "db.example.com"
    os.environ["DB_USER"] = "admin"
    os.environ["DB_PASSWORD"] = "secret"
    os.environ["DB_SSL_MODE"] = "require"
    # Don't set DB_NAME - it will be created as: ingestion_YYYYMMDD_HHMMSS
    
    os.environ["LLM_API_BASE"] = "http://localhost:11434/v1"
    os.environ["LLM_MODEL"] = "qwen2.5-coder:14b"
    
    # Ingest - both DB and table names auto-generated
    # result = ingest_file("https://api.example.com/data.json")
    # print(f"Created database: {result['database']}")
    # print(f"Created table: {result['table']}")
    
    print("(Uncomment to run)")


def example_aws_rds():
    """Example: AWS RDS with SSL verification."""
    print("\n" + "=" * 60)
    print("Example 3: AWS RDS with Certificate Verification")
    print("=" * 60)
    
    os.environ["DB_HOST"] = "mydb.abc123.us-east-1.rds.amazonaws.com"
    os.environ["DB_USER"] = "admin"
    os.environ["DB_PASSWORD"] = "secure-password"
    os.environ["DB_SSL_MODE"] = "verify-ca"
    os.environ["DB_SSL_ROOT_CERT"] = "./rds-ca-2019-root.pem"
    
    os.environ["LLM_API_BASE"] = "https://api.openai.com/v1"
    os.environ["LLM_MODEL"] = "gpt-4"
    os.environ["LLM_API_KEY"] = os.getenv("OPENAI_API_KEY", "")
    
    # result = ingest_file("s3://my-bucket/data.csv")
    
    print("(Uncomment to run)")


def example_google_cloud_sql():
    """Example: Google Cloud SQL with mutual TLS."""
    print("\n" + "=" * 60)
    print("Example 4: Google Cloud SQL with Mutual TLS")
    print("=" * 60)
    
    os.environ["DB_HOST"] = "34.123.45.67"  # Public IP
    os.environ["DB_USER"] = "postgres"
    os.environ["DB_PASSWORD"] = "secure-password"
    os.environ["DB_SSL_MODE"] = "verify-ca"
    os.environ["DB_SSL_ROOT_CERT"] = "./server-ca.pem"
    os.environ["DB_SSL_CERT"] = "./client-cert.pem"
    os.environ["DB_SSL_KEY"] = "./client-key.pem"
    
    os.environ["LLM_API_BASE"] = "https://api.openai.com/v1"
    os.environ["LLM_MODEL"] = "gpt-4"
    os.environ["LLM_API_KEY"] = os.getenv("OPENAI_API_KEY", "")
    
    # result = ingest_file("https://storage.googleapis.com/bucket/data.json")
    
    print("(Uncomment to run)")


def example_local_sqlite():
    """Example: Local SQLite for development."""
    print("\n" + "=" * 60)
    print("Example 5: Local SQLite (Development)")
    print("=" * 60)
    
    os.environ["DB_TYPE"] = "sqlite"
    os.environ["DB_NAME"] = "./mydata.db"
    
    os.environ["LLM_API_BASE"] = "http://localhost:11434/v1"
    os.environ["LLM_MODEL"] = "qwen2.5-coder:14b"
    
    # result = ingest_file("./local_data.csv", table_name="my_table")
    
    print("(Uncomment to run)")


def example_batch_ingestion():
    """Example: Batch ingestion with Redis caching."""
    print("\n" + "=" * 60)
    print("Example 6: Batch Ingestion with Caching")
    print("=" * 60)
    
    os.environ["DB_HOST"] = "db.example.com"
    os.environ["DB_USER"] = "admin"
    os.environ["DB_PASSWORD"] = "secret"
    os.environ["DB_SSL_MODE"] = "require"
    os.environ["DB_NAME"] = "warehouse"
    
    os.environ["LLM_API_BASE"] = "https://api.openai.com/v1"
    os.environ["LLM_MODEL"] = "gpt-4"
    os.environ["LLM_API_KEY"] = os.getenv("OPENAI_API_KEY", "")
    
    # Redis for caching schema/results
    os.environ["REDIS_URL"] = "rediss://:password@redis.example.com:6380"
    
    sources = [
        ("s3://bucket/users.csv", "users"),
        ("s3://bucket/orders.csv", "orders"),
        ("s3://bucket/products.csv", "products"),
    ]
    
    results = []
    for source, table_name in sources:
        print(f"\nIngesting {source}...")
        # result = ingest_file(source, table_name)
        # results.append(result)
        # print(f"  ✓ {result['rows_ingested']} rows into {result['table']}")
    
    print("\n(No sources configured - add URLs to run)")
    
    if results:
        print(f"\nTotal: {sum(r['rows_ingested'] for r in results)} rows ingested")


def main():
    """Run all examples."""
    example_cloud_postgres()
    example_auto_create_db()
    example_aws_rds()
    example_google_cloud_sql()
    example_local_sqlite()
    example_batch_ingestion()
    
    print("\n" + "=" * 60)
    print("Summary")
    print("=" * 60)
    print("""
Key Features Demonstrated:
1. Secure connections to cloud databases (SSL/TLS)
2. Database auto-creation (no DB_NAME needed)
3. Certificate verification for RDS
4. Mutual TLS for Google Cloud SQL
5. Local SQLite for development
6. Redis caching with SSL

All configuration via environment variables - no code changes needed!
""")


if __name__ == "__main__":
    main()
