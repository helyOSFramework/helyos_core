SET client_min_messages TO WARNING;

--
-- Function used for query and mutations
--

CREATE OR REPLACE FUNCTION public.selectToolPoseHistory(
  start_time DOUBLE PRECISION, end_time DOUBLE PRECISION)
RETURNS SETOF public.agent_poses
LANGUAGE 'sql'
COST 100
STABLE
ROWS 1000
AS $BODY$
  SELECT * FROM public.agent_poses WHERE created_at < to_timestamp(end_time) AND created_at > to_timestamp(start_time);
$BODY$;

--
-- Function used by the Triggers: notifications on updates and automatic procedures
--

CREATE OR REPLACE FUNCTION public.create_row_tool_sensors_history()
RETURNS TRIGGER AS
$BODY$
DECLARE
  updated_agent_id BIGINT;
BEGIN
  updated_agent_id := NEW.id;

  INSERT INTO public.agent_poses (agent_id, yard_id, x, y, z, work_process_id, orientation, orientations, sensors, status, assignment)
    SELECT T.id, T.yard_id, T.x, T.y, T.z, T.work_process_id, T.orientation, T.orientations, T.sensors, T.status, T.assignment
    FROM public.agents AS T
    WHERE id = updated_agent_id;
  RETURN NULL;
END; 
$BODY$
LANGUAGE plpgsql VOLATILE
COST 100;



CREATE OR REPLACE FUNCTION public.notify_change_tool()
RETURNS TRIGGER AS
$BODY$
BEGIN
  IF (OLD.status IS DISTINCT FROM NEW.status OR OLD.connection_status IS DISTINCT FROM NEW.connection_status) THEN
    PERFORM pg_notify('change_agent_status',
      (SELECT row_to_json(r.*)::VARCHAR FROM (
        SELECT id, uuid, yard_id FROM public.agents WHERE id = NEW.id)
      r)
    );

    INSERT INTO public.events_queue (event_name, payload)
    VALUES ('change_agent_status',
      (SELECT row_to_json(r.*)::TEXT FROM (
        SELECT id, status, uuid, name, connection_status, yard_id, modified_at FROM public.agents WHERE id = NEW.id)
      r)
    );
  END IF;

  IF (OLD.public_key IS DISTINCT FROM NEW.public_key OR OLD.verify_signature IS DISTINCT FROM NEW.verify_signature OR
      OLD.rbmq_username IS DISTINCT FROM NEW.rbmq_username OR OLD.allow_anonymous_checkin IS DISTINCT FROM NEW.allow_anonymous_checkin) THEN
    PERFORM pg_notify('change_agent_security', 
      (SELECT row_to_json(r.*)::VARCHAR FROM (
        SELECT id, uuid, yard_id, modified_at FROM public.agents WHERE id = NEW.id)
      r)
    );

    INSERT INTO public.events_queue (event_name, payload)
    VALUES ('change_agent_security',
      (SELECT row_to_json(r.*)::TEXT FROM (
        SELECT id, public_key, uuid, verify_signature, rbmq_username, allow_anonymous_checkin, yard_id, modified_at
        FROM public.agents WHERE id = NEW.id)
      r)
    );
  END IF;

  IF (OLD.read_permissions IS DISTINCT FROM NEW.read_permissions OR
      OLD.write_permissions IS DISTINCT FROM NEW.write_permissions OR
      OLD.configure_permissions IS DISTINCT FROM NEW.configure_permissions) THEN
    PERFORM pg_notify('change_rabbitmq_permissions', 
      (SELECT row_to_json(r.*)::VARCHAR FROM (
        SELECT id, uuid, yard_id FROM public.agents WHERE id = NEW.id)
      r)
    );

    INSERT INTO public.events_queue (event_name, payload)
    VALUES ('change_rabbitmq_permissions',
      (SELECT row_to_json(r.*)::TEXT FROM (
        SELECT id, uuid, uuid, yard_id, rbmq_username, read_permissions, write_permissions, configure_permissions
        FROM public.agents WHERE id = NEW.id)
      r)
    );
  END IF;

  RETURN NULL;
END; 
$BODY$
LANGUAGE plpgsql VOLATILE
COST 100
SECURITY DEFINER;
ALTER FUNCTION public.notify_change_tool() OWNER TO role_admin;

DROP FUNCTION public.notify_new_rabbitmq_account(
  agent_id INT,
  username TEXT,
  password TEXT
);

CREATE OR REPLACE PROCEDURE public.notify_new_rabbitmq_account(
  agent_id INT,
  username TEXT,
  password TEXT
) AS
$BODY$
BEGIN
  PERFORM pg_notify('new_rabbitmq_account', (json_build_object('agent_id', agent_id))::TEXT);

  INSERT INTO public.events_queue (event_name, payload)
  VALUES ('new_rabbitmq_account', json_build_object('username', username, 'password', password, 'agent_id', agent_id)::TEXT);
END; 
$BODY$
LANGUAGE plpgsql;


-- Function that notifies the deletion of a tool
CREATE OR REPLACE FUNCTION public.notify_deleted_tool()
RETURNS TRIGGER AS
$BODY$
BEGIN
  PERFORM pg_notify(
    'agent_deletion',
    json_build_object(
      'id', OLD.id,
      'uuid', OLD.uuid,
      'rbmq_username', OLD.rbmq_username,
      'yard_id', OLD.yard_id
    )::TEXT
  );

  INSERT INTO public.events_queue (event_name, payload)
  VALUES ('agent_deletion', json_build_object(
      'id', OLD.id,
      'uuid', OLD.uuid,
      'rbmq_username', OLD.rbmq_username,
      'yard_id', OLD.yard_id
    )::TEXT);
  
  RETURN NULL;
END; 
$BODY$
LANGUAGE plpgsql
COST 100
SECURITY DEFINER;
ALTER FUNCTION public.notify_deleted_tool() OWNER TO role_admin;

---------------------
-- CREATE/UPDATE RABBITMQ ACCOUNT FOR AGENT --
---------------------

CREATE OR REPLACE FUNCTION public.register_rabbitmq_account(
  agent_id INT,
  username TEXT,
  password TEXT
) RETURNS INT AS $$
DECLARE
  v_RowCountInt INT;
BEGIN
  UPDATE public.agents AS A SET rbmq_username=username, rbmq_encrypted_password=crypt(password, gen_salt('bf')) WHERE A.id=$1;
  GET DIAGNOSTICS v_RowCountInt = ROW_COUNT;
  IF v_RowCountInt = 0 THEN 
    RAISE EXCEPTION SQLSTATE '90004' USING MESSAGE = 'agent id not found';
  END IF;

  CALL public.notify_new_rabbitmq_account(agent_id, username, password);

  RETURN 0;
END
$$ LANGUAGE plpgsql STRICT SECURITY DEFINER;

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
EXECUTE FUNCTION public.create_row_tool_sensors_history();



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
      OLD.allow_anonymous_checkin IS DISTINCT FROM NEW.allow_anonymous_checkin OR
      OLD.read_permissions IS DISTINCT FROM NEW.read_permissions OR
      OLD.write_permissions IS DISTINCT FROM NEW.write_permissions OR
      OLD.configure_permissions IS DISTINCT FROM NEW.configure_permissions
      )
EXECUTE FUNCTION public.notify_change_tool();



-- Deletions in tool is promptly notified to helyOs core
DROP TRIGGER IF EXISTS delete_tool_trigger ON public.agents;
CREATE TRIGGER delete_tool_trigger
AFTER DELETE
ON public.agents
FOR EACH ROW
EXECUTE FUNCTION public.notify_deleted_tool();

GRANT EXECUTE ON FUNCTION public.create_row_tool_sensors_history() TO role_admin, role_application, role_postgraphile;
GRANT EXECUTE ON FUNCTION public.register_rabbitmq_account(agent_id INT,
                                                           username TEXT,
                                                           password TEXT
                                                          ) TO role_admin, role_postgraphile;