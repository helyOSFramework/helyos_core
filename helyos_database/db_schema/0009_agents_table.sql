CREATE TABLE IF NOT EXISTS public.agents (
  id BIGSERIAL PRIMARY KEY,
  yard_id BIGINT REFERENCES public.yards(id) ON DELETE SET NULL,
  work_process_id BIGINT REFERENCES public.work_processes(id) ON DELETE SET NULL,
  proxy_tool_id BIGINT,
  agent_class CHARACTER VARYING DEFAULT 'vehicle',
  agent_type CHARACTER VARYING,
  connection_status CHARACTER VARYING DEFAULT 'offline',
  code CHARACTER VARYING,
  name CHARACTER VARYING,
  description CHARACTER VARYING,
  message_channel CHARACTER VARYING,
  public_key CHARACTER VARYING,
  public_key_format CHARACTER VARYING(255) DEFAULT 'PEM',
  verify_signature BOOLEAN DEFAULT FALSE,
  picture TEXT,
  is_actuator BOOLEAN DEFAULT TRUE,
  is_simulator BOOLEAN DEFAULT FALSE,

  -- RABBITMQ CONNECTION
  rbmq_username CHARACTER VARYING(255) DEFAULT NULL,
  rbmq_vhost CHARACTER VARYING(255) DEFAULT NULL,
  rbmq_encrypted_password TEXT DEFAULT '',
  has_rbmq_account BOOLEAN DEFAULT FALSE,
  protocol TEXT DEFAULT 'AMQP',
  msg_per_sec FLOAT DEFAULT 0,
  updt_per_sec FLOAT DEFAULT 0,

  operation_types CHARACTER VARYING[],
  last_message_time TIMESTAMP(6) WITHOUT TIME ZONE NOT NULL DEFAULT NOW(),
  created_at TIMESTAMP(6) WITHOUT TIME ZONE NOT NULL DEFAULT NOW(),
  modified_at TIMESTAMP(6) WITHOUT TIME ZONE NOT NULL DEFAULT NOW(),
  stream_url CHARACTER VARYING,
  allow_anonymous_checkin BOOLEAN DEFAULT TRUE,
  uuid CHARACTER VARYING,

  -- THE MESSAGE BROKER WILL UPDATE THESE PROPERTIES
  geometry JSONB,
  factsheet JSONB,
  x FLOAT DEFAULT 0,
  y FLOAT DEFAULT 0,
  z FLOAT DEFAULT 0,
  unit CHARACTER VARYING DEFAULT 'mm - mrad',
  orientation FLOAT,
  orientations FLOAT[],
  coordinate_frame CHARACTER VARYING DEFAULT 'local-UTM',
  reference_point CHARACTER VARYING DEFAULT 'front-axle-center',
  status CHARACTER VARYING,
  state CHARACTER VARYING,
  sensors JSONB,
  wp_clearance JSONB,
  assignment JSONB,
  resources JSONB,
  acknowledge_reservation BOOLEAN DEFAULT TRUE,
  sensors_data_format CHARACTER VARYING DEFAULT 'helyos-native',
  geometry_data_format CHARACTER VARYING DEFAULT 'trucktrix-vehicle',
  data_format CHARACTER VARYING DEFAULT 'trucktrix-vehicle',
  read_permissions CHARACTER VARYING DEFAULT '.*',
  write_permissions CHARACTER VARYING DEFAULT '.*',
  configure_permissions CHARACTER VARYING DEFAULT '.*',

  UNIQUE(uuid),

  CONSTRAINT status_check CHECK (
    status IS NULL OR
    status IN (
      'not_automatable',
      'free',
      'ready',
      'busy'
    )
  ),

  CONSTRAINT agent_class_check CHECK (
    agent_class IN (
      'vehicle',
      'tool',
      'assistant',
      'charge_station'
    )
  )
);

COMMENT ON COLUMN agents.factsheet IS '@ agent geometry object';
COMMENT ON COLUMN agents.acknowledge_reservation IS '@ if false helyOS will send the assignment immediately after the reservation request.';
COMMENT ON COLUMN agents.geometry IS '@ agent geometry object';
COMMENT ON COLUMN agents.status IS '@ agent status: Deprecated. It will be converted to state.';
COMMENT ON COLUMN agents.state IS '@ agent state: "free", "busy", "ready"';
COMMENT ON COLUMN agents.connection_status IS '@ agent connection status: "online", "offline" (more than 30 seconds without any agent update)'; 
COMMENT ON COLUMN agents.rbmq_vhost IS '@ rabbitmq virtual host'; 
COMMENT ON COLUMN agents.rbmq_encrypted_password IS '@ rabbitmq password for the agent: random password hashed using the agent public key'; 

COMMENT ON COLUMN agents.x IS '@ agent x pose - horizontal (unit)';
COMMENT ON COLUMN agents.y IS '@ agent y pose - vertical (unit)';
COMMENT ON COLUMN agents.z IS '@ agent z pose - altitude (unit)';
COMMENT ON COLUMN agents.orientations IS '@ agent orientations (mrad)';
COMMENT ON COLUMN agents.wp_clearance IS '@ agent response for the last request to change its status to "READY" for a specific work process';
COMMENT ON COLUMN agents.sensors_data_format IS '@ JSON data structure for the field sensors';

-- High-performance table: No foreign keys are defined in order to reduce the impact in INSERT operations.
CREATE TABLE IF NOT EXISTS public.agent_poses (
  id BIGSERIAL PRIMARY KEY,
  tool_id BIGINT,
  agent_id BIGINT,
  yard_id BIGINT,
  work_process_id BIGINT,
  x FLOAT,
  y FLOAT,
  z FLOAT,
  orientation FLOAT,
  orientations FLOAT[],
  sensors JSONB,
  status CHARACTER VARYING,
  assignment JSONB,
  created_at TIMESTAMP(6) WITHOUT TIME ZONE NOT NULL DEFAULT NOW()
);

COMMENT ON COLUMN agent_poses.agent_id IS '@ agent_id foreign key to agents';
COMMENT ON COLUMN agent_poses.x IS '@ agent x pose in relative yard coordinates (arb unit)';
COMMENT ON COLUMN agent_poses.y IS '@ agent y pose in relative yard coordinates (arb unit)';
COMMENT ON COLUMN agent_poses.orientation IS '@ agent orientation (mrad)';
COMMENT ON COLUMN agent_poses.sensors IS '@ object with sensor data from tool';