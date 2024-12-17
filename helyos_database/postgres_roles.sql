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
SET default_with_oids = FALSE;

-- ROLES: admin, visualization, application, anonymous. The postgraphile role is used to connect to the database with the postgraphile library.
CREATE ROLE role_anonymous;
CREATE ROLE role_application;
CREATE ROLE role_admin;
CREATE ROLE role_visualization;

GRANT USAGE ON SCHEMA public TO role_anonymous, role_application, role_admin;

-- USER ACCOUNT TABLE PRIVILEGES 
GRANT SELECT ON TABLE public.users TO role_anonymous, role_application, role_admin;
GRANT UPDATE, DELETE ON TABLE public.users TO role_application, role_admin;

-- VISUALIZATION ACCOUNTS TABLE PRIVILEGES 
GRANT SELECT ON TABLE public.work_process_type TO role_visualization;
GRANT SELECT ON TABLE public.yards TO role_visualization;
GRANT SELECT ON TABLE public.map_objects TO role_visualization;
GRANT SELECT ON TABLE public.agents TO role_visualization;
GRANT SELECT ON TABLE public.agent_poses TO role_visualization;
GRANT SELECT ON TABLE public.assignments TO role_visualization;
GRANT SELECT ON TABLE public.system_logs TO role_visualization; 
GRANT SELECT ON TABLE public.work_process_service_plan TO role_visualization; 
GRANT SELECT ON TABLE public.instant_actions TO role_visualization; 
GRANT SELECT ON TABLE public.mission_queue TO role_visualization; 
GRANT SELECT ON TABLE public.work_processes TO role_visualization; 

-- APPLICATION ACCOUNTS TABLE PRIVILEGES 
GRANT SELECT ON TABLE public.work_process_type TO role_application;
GRANT SELECT ON TABLE public.agent_poses TO role_application;
GRANT SELECT ON TABLE public.assignments TO role_application;
GRANT SELECT ON TABLE public.system_logs TO role_application; 
GRANT SELECT ON TABLE public.work_process_service_plan TO role_application; 

GRANT SELECT, UPDATE ON TABLE public.agents TO role_application;
GRANT SELECT, INSERT ON TABLE public.instant_actions TO role_application; 
GRANT SELECT, UPDATE ON TABLE public.yards TO role_application;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.map_objects TO role_application;

GRANT SELECT, INSERT, UPDATE ON TABLE public.work_processes TO role_application;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.mission_queue TO role_application; 
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.agents_interconnections TO role_application;

-- ADMIN ACCOUNTS TABLE PRIVILEGES 
-- Admin users can do anything, including get data about microservices: url, api-key, etc. 
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.work_processes TO role_admin;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.agents TO role_admin;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.user_account TO role_admin;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.assignments TO role_admin; 
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.work_process_service_plan TO role_admin; 
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.work_process_type TO role_admin;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.yards TO role_admin;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.map_objects TO role_admin;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.agent_poses TO role_admin;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.assignments TO role_admin; 
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.services TO role_admin; 
GRANT SELECT, INSERT, DELETE ON TABLE public.system_logs TO role_admin; 
GRANT SELECT, INSERT, DELETE ON TABLE public.events_queue TO role_admin; 

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.work_process_service_plan TO role_admin; 
GRANT SELECT, INSERT, DELETE ON TABLE public.service_requests TO role_admin; 
GRANT SELECT, INSERT, DELETE ON TABLE public.instant_actions TO role_admin; 
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.mission_queue TO role_admin;
GRANT SELECT ON TABLE public.rbmq_config TO role_admin;

-- SEQUENCES PRIVILEGES -- I have already granted the write rights to the table, it should be enough, but it was not.
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO role_admin;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO role_admin;

GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO role_admin;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO role_application;

GRANT role_application TO role_admin;

GRANT role_anonymous TO role_postgraphile;
GRANT role_admin TO role_postgraphile;
GRANT role_application TO role_postgraphile;