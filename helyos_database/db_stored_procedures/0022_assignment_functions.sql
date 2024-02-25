 

--  Function used by the Triggers:  notifications on updates and automatic procedures
--

CREATE OR REPLACE FUNCTION public.notify_assignments_insertion()
  RETURNS trigger AS
$BODY$
   BEGIN
       PERFORM pg_notify('assignments_insertion',            
            (SELECT row_to_json(r.*)::varchar FROM (
             SELECT  id, yard_id,  work_process_id, agent_id, status, start_time_stamp from public.assignments  where id = NEW.id)
            r)
        );
       RETURN NULL;
   END; 
$BODY$
  LANGUAGE plpgsql VOLATILE
  COST 100;

  
CREATE OR REPLACE FUNCTION public.notify_assignments_updates()
RETURNS trigger AS
$BODY$
    BEGIN
        PERFORM pg_notify('assignments_status_update', 
            (SELECT row_to_json(r.*)::varchar FROM (
            SELECT id, yard_id,  work_process_id, agent_id, status, start_time_stamp from public.assignments  where id = NEW.id)
            r)
        );
        RETURN NULL;
    END; 
$BODY$
  LANGUAGE plpgsql VOLATILE
  COST 100;



--
-- Notifications
--

DROP TRIGGER IF EXISTS notify_assignments_insertion ON public.assignments;
CREATE TRIGGER notify_assignments_insertion
  AFTER INSERT
  ON public.assignments
  FOR EACH ROW
  EXECUTE PROCEDURE public.notify_assignments_insertion();


DROP TRIGGER IF EXISTS notify_assignments_updates ON public.assignments;
CREATE TRIGGER notify_assignments_updates
  AFTER UPDATE 
  ON public.assignments
  FOR EACH ROW 
  WHEN (OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE PROCEDURE public.notify_assignments_updates();



