 
--
--  Function used for query and mutations
--


CREATE OR REPLACE FUNCTION public.selectToolPoseHistory(
	start_time double precision, end_time double precision)
    RETURNS SETOF public.agent_poses 
    LANGUAGE 'sql'

    COST 100
    STABLE 
    ROWS 1000
AS $BODY$

 SELECT *  FROM public.agent_poses WHERE created_at < to_timestamp(end_time) AND  created_at > to_timestamp(start_time);
 
$BODY$;



--
--  Function used by the Triggers:  notifications on updates and automatic procedures
--

CREATE OR REPLACE FUNCTION public.create_row_tool_sensors_history()
  RETURNS trigger AS
$BODY$
    DECLARE
     updated_agent_id  bigint;

    BEGIN
      updated_agent_id := NEW.id;

        INSERT INTO public.agent_poses (agent_id, yard_id, x, y, z, work_process_id, orientation, orientations, sensors, status, assignment)
          SELECT T.id, T.yard_id, T.x, T.y, T.z, T.work_process_id, T.orientation, T.orientations, T.sensors, T.status, T.assignment
          FROM   public.agents AS T
          WHERE id = updated_agent_id;
        RETURN NULL;
    END; 
$BODY$
  LANGUAGE plpgsql VOLATILE
  COST 100;





CREATE OR REPLACE FUNCTION public.notify_change_tool()
RETURNS trigger AS
$BODY$
    BEGIN

    IF (OLD.status IS DISTINCT FROM NEW.status OR OLD.connection_status IS DISTINCT FROM NEW.connection_status) THEN
      PERFORM pg_notify('change_agent_status', 
            (SELECT row_to_json(r.*)::varchar FROM (
            SELECT  id, status, uuid, name, connection_status, yard_id, modified_at from public.agents where id = NEW.id)
            r)
        );
    END IF;

    IF (OLD.public_key IS DISTINCT FROM NEW.public_key OR OLD.verify_signature IS DISTINCT FROM NEW.verify_signature OR
        OLD.rbmq_username IS DISTINCT FROM NEW.rbmq_username OR OLD.allow_anonymous_checkin IS DISTINCT FROM NEW.allow_anonymous_checkin) THEN
      PERFORM pg_notify('change_agent_security', 
            (SELECT row_to_json(r.*)::varchar FROM (
            SELECT  id, public_key, uuid, verify_signature, rbmq_username, allow_anonymous_checkin, yard_id, modified_at from public.agents where id = NEW.id)
            r)
        );
    END IF;

    RETURN NULL;
    END; 
$BODY$
  LANGUAGE plpgsql VOLATILE
  COST 100;



CREATE OR REPLACE PROCEDURE public.notify_new_rabbitmq_account(
  agent_id int,
  username text,
  password text
) AS
$BODY$
    BEGIN
       PERFORM pg_notify('new_rabbitmq_account', (json_build_object('username', username, 'password', password, 'agent_id', agent_id))::text);
    END; 
$BODY$
LANGUAGE plpgsql;


-- Function that notifies the deletion of a tool
CREATE OR REPLACE FUNCTION public.notify_deleted_tool()
RETURNS trigger AS
$BODY$
    BEGIN

          PERFORM pg_notify(
          'agent_deletion', 
          json_build_object(
              'id', OLD.id, 
              'uuid', OLD.uuid, 
              'rbmq_username', OLD.rbmq_username,
              'yard_id', OLD.yard_id
          )::text
      );
        RETURN NULL;
    END; 
$BODY$
LANGUAGE plpgsql;


---------------------
-- CREATE/UPDATE RABBITMQ ACCOUNT FOR AGENT --
---------------------

-------------------
CREATE OR REPLACE FUNCTION  public.register_rabbitmq_account(
  agent_id int,
  username text,
  password text
) RETURNS int as $$

DECLARE
  v_RowCountInt int;
BEGIN

  update  public.agents as A set rbmq_username=username, rbmq_encrypted_password=crypt(password, gen_salt('bf')) where A.id=$1;
  GET DIAGNOSTICS v_RowCountInt = ROW_COUNT;
  IF v_RowCountInt = 0 then 
    RAISE EXCEPTION SQLSTATE '90004' USING MESSAGE = 'agent id not found' ;
  END IF;

  
  CALL public.notify_new_rabbitmq_account(agent_id, username, password);

  return 0;

END
$$  language plpgsql strict security definer;


comment on function public.admin_change_password(text,text) is 'Admin changes regular user passwords.';



--
-- Notifications
--

-- Changes in tool sensors are automatically creating a row in tool sensor history table: agent_poses
-- These changes are however only saved when the agent is busy or when its status change.
DROP TRIGGER IF EXISTS change_sensors_trigger ON public.agents;
CREATE TRIGGER change_sensors_trigger
AFTER UPDATE 
ON public.agents
FOR EACH ROW 
WHEN ( (OLD.status IS DISTINCT FROM NEW.status) OR ( NEW.status = 'busy'
                                                     AND (OLD.x IS DISTINCT FROM NEW.x OR 
                                                          OLD.y IS DISTINCT FROM NEW.y OR 
                                                          OLD.z IS DISTINCT FROM NEW.z OR
                                                          OLD.assignment IS DISTINCT FROM NEW.assignment
                                                          )))
EXECUTE PROCEDURE public.create_row_tool_sensors_history();




-- Changes in tool status is promptly notified to helyOs core
DROP TRIGGER IF EXISTS change_tool_status_trigger ON public.agents;
CREATE TRIGGER change_tool_status_trigger
AFTER UPDATE 
ON public.agents
FOR EACH ROW 
WHEN (OLD.status IS DISTINCT FROM NEW.status OR OLD.connection_status IS DISTINCT FROM NEW.connection_status OR
      OLD.protocol IS DISTINCT FROM NEW.protocol OR
      OLD.public_key IS DISTINCT FROM NEW.public_key OR
      OLD.verify_signature IS DISTINCT FROM NEW.verify_signature OR
      OLD.rbmq_username IS DISTINCT FROM NEW.rbmq_username OR
      OLD.allow_anonymous_checkin IS DISTINCT FROM NEW.allow_anonymous_checkin
      )
EXECUTE PROCEDURE public.notify_change_tool();


-- Deletions in tool is promptly notified to helyOs core
DROP TRIGGER IF EXISTS delete_tool_trigger ON public.agents;
CREATE TRIGGER delete_tool_trigger
AFTER DELETE 
ON public.agents
FOR EACH ROW 
EXECUTE PROCEDURE public.notify_deleted_tool();







grant execute on function public.create_row_tool_sensors_history() to role_admin, role_application, role_postgraphile;
grant execute on function public.register_rabbitmq_account() to role_admin, role_postgraphile;

