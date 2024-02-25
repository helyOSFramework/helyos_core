 


CREATE OR REPLACE FUNCTION public.notify_instant_actions_insertion()
  RETURNS trigger AS
  $BODY$
    BEGIN
        PERFORM pg_notify('instant_actions_insertion',            
              (SELECT row_to_json(r.*)::varchar FROM (
              SELECT id, agent_id, agent_uuid, sender, command from public.instant_actions  where id = NEW.id)
              r)
          );
        RETURN NULL;
    END; 
  $BODY$
  LANGUAGE plpgsql VOLATILE
  COST 100;



DROP TRIGGER IF EXISTS trigger_new_instant_action_trigger ON public.instant_actions;
CREATE TRIGGER trigger_new_instant_action_trigger
  AFTER INSERT ON  public.instant_actions
  FOR EACH ROW
  EXECUTE PROCEDURE  public.notify_instant_actions_insertion();


