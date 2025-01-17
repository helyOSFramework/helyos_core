SET client_min_messages TO WARNING;

--
-- Function used by the Triggers: notifications on updates and automatic procedures
--

CREATE OR REPLACE FUNCTION public.notify_mission_queue_update()
RETURNS TRIGGER AS
$BODY$
BEGIN
  PERFORM pg_notify('mission_queue_update',
    (SELECT row_to_json(r.*)::VARCHAR FROM (
      SELECT id, sched_start_at
      FROM public.mission_queue
      WHERE id = NEW.id) r)
  );

  INSERT INTO public.events_queue (event_name, payload)
  VALUES ('mission_queue_update',
    (SELECT row_to_json(r.*)::TEXT FROM (
      SELECT id, status, sched_start_at
      FROM public.mission_queue
      WHERE id = NEW.id) r
    )
  );
  
  RETURN NULL;
END; 
$BODY$
LANGUAGE plpgsql VOLATILE
COST 100
SECURITY DEFINER;
ALTER FUNCTION public.notify_mission_queue_update() OWNER TO role_admin;


CREATE OR REPLACE FUNCTION public.notify_mission_queue_insertion()
RETURNS TRIGGER AS
$BODY$
BEGIN
  PERFORM pg_notify('mission_queue_insertion',
    (SELECT row_to_json(r.*)::VARCHAR FROM (
      SELECT id, status, sched_start_at
      FROM public.mission_queue
      WHERE id = NEW.id) r)
  );

  INSERT INTO public.events_queue (event_name, payload)
  VALUES ('mission_queue_insertion',
    (SELECT row_to_json(r.*)::TEXT FROM (
      SELECT id, status, sched_start_at
      FROM public.mission_queue
      WHERE id = NEW.id) r
    )
  );
  
  RETURN NULL;
END; 
$BODY$
LANGUAGE plpgsql VOLATILE
COST 100
SECURITY DEFINER;
ALTER FUNCTION public.notify_mission_queue_insertion() OWNER TO role_admin;

--
-- Notifications
--


DROP TRIGGER IF EXISTS notify_mission_queue_update ON public.mission_queue;
CREATE TRIGGER notify_mission_queue_update
AFTER UPDATE
ON public.mission_queue
FOR EACH ROW
EXECUTE FUNCTION public.notify_mission_queue_update();


DROP TRIGGER IF EXISTS trigger_mission_queue_insertion ON public.mission_queue;
CREATE TRIGGER trigger_mission_queue_insertion
AFTER INSERT
ON public.mission_queue
FOR EACH ROW
EXECUTE FUNCTION public.notify_mission_queue_insertion();