 

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET client_min_messages = warning;
SET row_security = off;

SET default_tablespace = '';

SET default_with_oids = false;
DROP EXTENSION  IF EXISTS pgcrypto;
CREATE EXTENSION pgcrypto  WITH SCHEMA public;
;



CREATE TABLE IF NOT EXISTS public.schema_migrations (
    id bigserial PRIMARY KEY,
    version character varying NOT NULL,
    UNIQUE(version)
);



CREATE TABLE IF NOT EXISTS public.ar_internal_metadata (
    id bigserial PRIMARY KEY,
    key character varying NOT NULL,
    value character varying,
    created_at timestamp without time zone NOT NULL,
    updated_at timestamp without time zone NOT NULL
);


-- High-performance table: no keys or constraints are defined.
CREATE TABLE public.events_queue(
    id bigserial,
    created_at	timestamp without time zone default now(),
    event_name character varying,
    payload	text
);

CREATE TABLE public.rbmq_config(
    id bigserial PRIMARY KEY,
    agents_ul_exchange character varying DEFAULT 'xchange_helyos.agents.ul',
    agents_dl_exchange character varying DEFAULT 'xchange_helyos.agents.dl',
    agents_mqtt_exchange character varying DEFAULT 'xchange_helyos.agents.mqtt',
    agents_anonymous_exchange character varying DEFAULT 'xchange_helyos.agents.anonymous',
    rbmq_vhost character varying
);