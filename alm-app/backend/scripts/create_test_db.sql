-- Create test database for pytest.
-- Run as superuser: psql -U postgres -f scripts/create_test_db.sql
-- (From backend dir.) If alm_test already exists, ignore the error or drop it first.

CREATE DATABASE alm_test;

-- If you use a dedicated app user (e.g. alm), grant access:
-- GRANT ALL PRIVILEGES ON DATABASE alm_test TO alm;
