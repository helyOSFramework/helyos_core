 

--
--  Function used for query and mutations
--


CREATE OR REPLACE FUNCTION public.getWorkProcessActionData(w_process_id bigint)
    RETURNS SETOF public.assignments 
    LANGUAGE 'sql'

    COST 100
    STABLE 
    ROWS 1000
    AS $BODY$

        SELECT * FROM public.assignments  WHERE work_process_id=w_process_id;
    
    $BODY$;



CREATE OR REPLACE FUNCTION public.getAssignments(w_process_id bigint)
    RETURNS SETOF public.assignments 
    LANGUAGE 'sql'

    COST 100
    STABLE 
    ROWS 1000
    AS $BODY$

        SELECT * FROM public.assignments  WHERE work_process_id=w_process_id;
    
    $BODY$;


--
--  Function used by the Triggers:  notifications on updates and automatic procedures
--

CREATE OR REPLACE FUNCTION public.notify_work_processes_update()
RETURNS trigger AS
$BODY$
    BEGIN
        PERFORM pg_notify('work_processes_update',            
            (SELECT row_to_json(r.*)::varchar FROM (
             SELECT id, yard_id, work_process_type_id 
             FROM public.work_processes 
             WHERE id = NEW.id) r)
        );
        
        INSERT INTO public.events_queue (event_name, payload)
        VALUES ('work_processes_update', 
            (SELECT row_to_json(r.*)::text FROM (
             SELECT id, yard_id, work_process_type_id, status, work_process_type_name,
                    agent_ids, on_assignment_failure, tools_uuids, agent_uuids, sched_start_at, fallback_mission
             FROM public.work_processes 
             WHERE id = NEW.id) r)
        );
        
        RETURN NULL;
    END; 
$BODY$
LANGUAGE plpgsql VOLATILE
COST 100;


CREATE OR REPLACE FUNCTION public.update_work_process_list_order()
  RETURNS trigger AS
$BODY$
   BEGIN
      NEW.run_order = (SELECT count(*)+1 from public.work_processes where mission_queue_id = NEW.mission_queue_id);
      RETURN NEW;
   END; 
$BODY$
  LANGUAGE plpgsql VOLATILE
  COST 100;


CREATE OR REPLACE FUNCTION public.notify_work_processes_insertion()
RETURNS trigger AS
$BODY$
   BEGIN
       PERFORM pg_notify('work_processes_insertion',            
            (SELECT row_to_json(r.*)::varchar FROM (
             SELECT id, yard_id 
             FROM public.work_processes 
             WHERE id = NEW.id) r)
        );
        
        INSERT INTO public.events_queue (event_name, payload)
        VALUES ('work_processes_insertion', 
            (SELECT row_to_json(r.*)::text FROM (
             SELECT id, yard_id, yard_uid, work_process_type_id, status, work_process_type_name, tools_uuids, agent_ids, agent_uuids, sched_start_at 
             FROM public.work_processes 
             WHERE id = NEW.id) r)
        );
        
       RETURN NULL;
   END; 
$BODY$
LANGUAGE plpgsql VOLATILE
COST 100;



CREATE OR REPLACE FUNCTION public.prevent_mission_running_update()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.data IS DISTINCT FROM NEW.data THEN
        RAISE EXCEPTION SQLSTATE '90005' USING MESSAGE = 'Request data cannot be updated in a running mission.';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;



--
-- Notifications
--
DROP TRIGGER IF EXISTS notify_work_processes_before_update ON public.work_processes;
CREATE TRIGGER notify_work_processes_before_update
BEFORE UPDATE 
ON public.work_processes
FOR EACH ROW
WHEN ( OLD.status  = 'executing' OR OLD.status  = 'calculating' ) 
EXECUTE PROCEDURE public.prevent_mission_running_update();


DROP TRIGGER IF EXISTS notify_work_processes_update ON public.work_processes;
CREATE TRIGGER notify_work_processes_update
AFTER UPDATE 
ON public.work_processes
FOR EACH ROW
EXECUTE PROCEDURE public.notify_work_processes_update();


DROP TRIGGER IF EXISTS trigger_work_processes_before_insertion ON public.work_processes;
CREATE TRIGGER trigger_work_processes_before_insertion
  BEFORE INSERT
  ON public.work_processes
  FOR EACH ROW
  WHEN (NEW.run_order IS NULL)
  EXECUTE PROCEDURE public.update_work_process_list_order();


DROP TRIGGER IF EXISTS trigger_work_processes_insertion ON public.work_processes;
CREATE TRIGGER trigger_work_processes_insertion
  AFTER INSERT
  ON public.work_processes
  FOR EACH ROW
  EXECUTE PROCEDURE public.notify_work_processes_insertion();


grant execute on function public.getWorkProcessActionData(work_process_id bigint)to role_admin, role_application, role_postgraphile;
