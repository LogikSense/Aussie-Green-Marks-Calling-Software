-- Create database for CRM Outcalling project (run as superuser, e.g. fardinkai)
-- Role voisai must already exist (see project docs). If not:
--   CREATE ROLE voisai WITH LOGIN PASSWORD '123456';
--   ALTER ROLE voisai CREATEDB;

CREATE DATABASE crm_outcalling_db OWNER voisai;
GRANT ALL PRIVILEGES ON DATABASE crm_outcalling_db TO voisai;

-- Test: psql postgresql://voisai:123456@localhost:5432/crm_outcalling_db
