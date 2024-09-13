 


--
--  Function used by the Triggers:  notifications on updates and automatic procedures
--

CREATE OR REPLACE FUNCTION public.notify_service_requests_insertion()
  RETURNS trigger AS
$BODY$
   BEGIN
       PERFORM pg_notify('service_requests_insertion',            
            (SELECT row_to_json(r.*)::varchar FROM (
             SELECT  id, work_process_id, fetched, processed, canceled, status from public.service_requests  where id = NEW.id)
            r)
        );
       RETURN NULL;
   END; 
$BODY$
  LANGUAGE plpgsql VOLATILE
  COST 100;

  
CREATE OR REPLACE FUNCTION public.notify_service_requests_updates()
RETURNS trigger AS
$BODY$
    BEGIN
        PERFORM pg_notify('service_requests_update', 
            (SELECT row_to_json(r.*)::varchar FROM (
            SELECT  id, work_process_id, fetched, processed, canceled, service_type, request_uid,
                    status, next_request_to_dispatch_uid, next_request_to_dispatch_uids, is_result_assignment, assignment_dispatched,
                     context->'map'->>'id' as yard_id from public.service_requests  where id = NEW.id)
            r)
        );
        RETURN NULL;
    END; 
$BODY$
  LANGUAGE plpgsql VOLATILE
  COST 100;


-- Changes status of the next service to "READY_TO_BE_SENT once the previous service is ready (result is not null)"
-- @TODO: If NEW.status = "FAILED" status of the next service changes to "DEPENDENCE_FAILED".

CREATE OR REPLACE FUNCTION public.send_next_service()
  RETURNS trigger AS
    $BODY$
    DECLARE
     next_planner_uid varchar;
     new_status  varchar;

    BEGIN
      new_status := TG_ARGV[0]; 
      next_planner_uid := NEW.next_request_to_dispatch_uid;

            UPDATE public.send_next_service SET  status =  new_status   WHERE planner_uid = next_planner_uid;
    END; 
    $BODY$
  LANGUAGE plpgsql VOLATILE
  COST 100;



--
-- Notifications
--


DROP TRIGGER IF EXISTS trigger_service_requests_ready ON public.service_requests;
CREATE TRIGGER trigger_service_requests_ready
AFTER UPDATE 
ON public.service_requests
FOR EACH ROW 
WHEN (OLD.response IS DISTINCT FROM NEW.response AND NEW.next_request_to_dispatch_uid IS NOT NULL AND NEW.status = 'SUCCESS')
EXECUTE PROCEDURE public.send_next_service('READY_TO_BE_SENT');


DROP TRIGGER IF EXISTS notify_service_requests_insertion ON public.service_requests;
CREATE TRIGGER notify_service_requests_insertion
  AFTER INSERT
  ON public.service_requests
  FOR EACH ROW
  EXECUTE PROCEDURE public.notify_service_requests_insertion();


DROP TRIGGER IF EXISTS notify_service_requests_updates ON public.service_requests;
CREATE TRIGGER notify_service_requests_updates
  AFTER UPDATE 
  ON public.service_requests
  FOR EACH ROW 
  EXECUTE PROCEDURE public.notify_service_requests_updates();



