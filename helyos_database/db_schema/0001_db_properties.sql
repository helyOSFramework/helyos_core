SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = ON;
SELECT pg_catalog.set_config('search_path', '', FALSE);
SET check_function_bodies = FALSE;
SET client_min_messages = WARNING;
SET row_security = OFF;

SET default_tablespace = '';

DROP EXTENSION IF EXISTS pgcrypto;
CREATE EXTENSION pgcrypto WITH SCHEMA public;

CREATE TABLE IF NOT EXISTS public.schema_migrations (
  id BIGSERIAL PRIMARY KEY,
  version CHARACTER VARYING NOT NULL,
  UNIQUE(version)
);

CREATE TABLE IF NOT EXISTS public.ar_internal_metadata (
  id BIGSERIAL PRIMARY KEY,
  key CHARACTER VARYING NOT NULL,
  value CHARACTER VARYING,
  created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL,
  updated_at TIMESTAMP WITHOUT TIME ZONE NOT NULL
);

-- High-performance table: no keys or constraints are defined.
CREATE TABLE public.events_queue (
  id BIGSERIAL,
  created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW(),
  event_name CHARACTER VARYING,
  payload TEXT
);

CREATE TABLE public.rbmq_config (
  id SERIAL PRIMARY KEY,
  agents_ul_exchange CHARACTER VARYING DEFAULT 'xchange_helyos.agents.ul',
  agents_dl_exchange CHARACTER VARYING DEFAULT 'xchange_helyos.agents.dl',
  agents_mqtt_exchange CHARACTER VARYING DEFAULT 'xchange_helyos.agents.mqtt',
  agents_anonymous_exchange CHARACTER VARYING DEFAULT 'xchange_helyos.agents.anonymous',
  rbmq_vhost CHARACTER VARYING
);