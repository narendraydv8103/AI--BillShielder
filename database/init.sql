-- Hospital Bill Auditor (India) - Database Initialization Script
-- Enables pgvector extension if supported on PostgreSQL instance

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Attempt pgvector extension creation (graceful if pgvector is not installed)
DO $$
BEGIN
    CREATE EXTENSION IF NOT EXISTS vector;
    RAISE NOTICE 'pgvector extension successfully initialized';
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'pgvector extension not installed or supported in this PostgreSQL build (optional vector search disabled)';
END
$$;
