-- Create test database for pytest. Run as superuser (e.g. postgres):
--   psql -U postgres -f scripts/create_test_db.sql
-- On Windows: psql -U postgres -f backend\scripts\create_test_db.sql
-- Or from backend dir: psql -U postgres -f scripts/create_test_db.sql

SELECT 'CREATE DATABASE alm_test'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'alm_test')\gexec

-- Grant access to alm user (adjust if your app user is different)
DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'alm') THEN
    EXECUTE 'GRANT ALL PRIVILEGES ON DATABASE alm_test TO alm';
  END IF;
END
$$;
