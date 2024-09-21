 


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


-- ROLES: admin, visualization, application, anonymous. The postgraphile role is used to connect to the database with the postgraphile library.
create role role_anonymous;
create role role_application;
create role role_admin;
create role role_visualization;

grant usage on schema public to role_anonymous, role_application, role_admin;

-- USER ACCOUNT TABLE PRIVILEDGES 
grant select on table public.users to role_anonymous, role_application, role_admin;
grant update, delete on table public.users  to role_application,  role_admin;


-- VISUALIZATOIN ACCOUNTS TABLE PRIVILEDGES 

grant select on table public.work_process_type to  role_visualization;
grant select on table public.yards to role_visualization;
grant select on table public.map_objects to  role_visualization;
grant select on table public.agents to role_visualization;
grant select on table public.agent_poses to role_visualization;
grant select on table public.assignments to role_visualization;
grant select on table public.system_logs to role_visualization; 
grant select on table public.work_process_service_plan to role_visualization; 
grant select on table public.instant_actions to role_visualization; 
grant select on table public.mission_queue to role_visualization; 
grant select on table public.work_processes to role_visualization; 



-- APPLICATION ACCOUNTS TABLE PRIVILEDGES 

grant select on table public.work_process_type to  role_application;
grant select on table public.agent_poses to role_application;
grant select on table public.assignments to role_application;
grant select on table public.system_logs to role_application; 
grant select on table public.work_process_service_plan to role_application; 

grant select, update on table public.agents to role_application;
grant select, insert on table public.instant_actions to role_application; 
grant select, update on table public.yards to role_application;
grant select, insert, update, delete on table public.map_objects to  role_application;

grant select, insert, update on table public.work_processes to  role_application;
grant select, insert, update, delete on table public.mission_queue to role_application; 
grant select, insert, update, delete on table public.agents_interconnections to role_application;



-- ADMIN ACCOUNTS TABLE PRIVILEDGES 
-- Admin users can do anything, including get data about microservices: url, api-key, etc. 
grant select, insert, update, delete on table public.work_processes to  role_admin;
grant select, insert, update, delete on table public.agents to role_admin;
grant select, insert, update, delete on table public.user_account to role_admin;
grant select, insert, update, delete on table public.assignments to role_admin; 
grant select, insert, update, delete on table public.work_process_service_plan to role_admin; 
grant select, insert, update, delete on table public.work_process_type to  role_admin;
grant select, insert, update, delete on table public.yards to role_admin;
grant select, insert, update, delete on table public.map_objects to role_admin;
grant select, insert, update, delete on table public.agent_poses to role_admin;
grant select, insert, update, delete on table public.assignments to role_admin; 
grant select, insert, update, delete on table public.services to role_admin; 
grant select, insert, delete on table public.system_logs to role_admin; 
grant select, insert, delete on table public.events_queue to role_admin; 

grant select, insert, update, delete on table public.work_process_service_plan to role_admin; 
grant select, insert, delete on table public.service_requests to role_admin; 
grant select, insert, delete on table public.instant_actions to role_admin; 
grant select, insert, update, delete on table public.mission_queue to role_admin;



-- SEQUENCES PRIVILEDGES --  I have already granted the write rigths to the table, it should be enough, but it was not.
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO role_admin;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
    GRANT USAGE, SELECT ON SEQUENCES TO role_admin;


GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO role_admin;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
    GRANT USAGE, SELECT ON SEQUENCES TO role_application;

grant role_application to role_admin;


grant role_anonymous to role_postgraphile;
grant role_admin to role_postgraphile;
grant role_application to role_postgraphile;

