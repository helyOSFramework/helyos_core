 




CREATE TABLE IF NOT EXISTS public.agents (
    id BIGSERIAL PRIMARY KEY,
    yard_id bigint REFERENCES public.yards(id) ON DELETE SET NULL,
    work_process_id bigint REFERENCES public.work_processes(id) ON DELETE SET NULL,

    proxy_tool_id bigint,
    agent_class character varying DEFAULT 'vehicle',
    agent_type character varying,
    connection_status character varying DEFAULT 'offline',
    code character varying,
    name character varying,
    description character varying,
    message_channel character varying,
    public_key character varying,
    public_key_format character varying(255) DEFAULT 'PEM',
    verify_signature boolean DEFAULT false,
    picture text,
    is_actuator boolean DEFAULT true,
    is_simulator boolean DEFAULT false,


    -- RABBITMQ CONNECTION
    rbmq_username character varying(255) DEFAULT NULL,
    rbmq_vhost character varying(255) DEFAULT NULL,
    rbmq_encrypted_password text DEFAULT '',
    has_rbmq_account boolean DEFAULT false,
    protocol text DEFAULT 'AMQP',
    msg_per_sec float DEFAULT 0, 
    updt_per_sec float DEFAULT 0,

    operation_types character varying[],
    last_message_time timestamp(6) without time zone NOT NULL DEFAULT NOW(),
    created_at timestamp(6) without time zone NOT NULL DEFAULT NOW(),
    modified_at timestamp(6) without time zone NOT NULL DEFAULT NOW(),
    stream_url character varying,
    allow_anonymous_checkin boolean DEFAULT true,
    uuid character varying,

    -- THE MESSAGE BROKER WILL UPDATE THESE PROPERTIES
    geometry jsonb,
    factsheet jsonb,
    x float DEFAULT 0,
    y float DEFAULT 0,
    z float DEFAULT 0,
    unit character varying DEFAULT 'mm - mrad',
    orientation float,
    orientations float[],
    coordinate_frame character varying DEFAULT 'local-UTM',
    reference_point character varying DEFAULT 'front-axle-center',
    status character varying,
    state character varying,
    sensors jsonb,
    wp_clearance jsonb,
    assignment jsonb,
    resources jsonb,
    acknowledge_reservation boolean DEFAULT true,
    sensors_data_format character varying default 'helyos-native',
    geometry_data_format character varying default 'trucktrix-vehicle',
    data_format character varying default 'trucktrix-vehicle',
    read_permissions character varying DEFAULT '.*',
    write_permissions character varying DEFAULT '.*',
    configure_permissions character varying DEFAULT '.*',
    
    UNIQUE(uuid),

    CONSTRAINT status_check CHECK (
    status IS NULL OR 
    status IN (
        'not_automatable', 
        'free',
        'ready',
        'busy'
    )),

    CONSTRAINT agent_class_check CHECK (
    agent_class IN (
        'vehicle', 
        'tool',
        'assistant'
    ))


);


comment on column agents.factsheet is '@ agent geometry object';
comment on column agents.acknowledge_reservation is '@ if false helyOS will send the assigment immediatelly after the reservation request.';
comment on column agents.geometry is '@ agent geometry object';
comment on column agents.status is '@ agent status: Depracated. It will be converted to state.';
comment on column agents.state is '@ agent state: "free", "busy", "ready"';
comment on column agents.connection_status is '@ agent connection status: "online", "offline" (more than 30 seconds without any agent update)'; 
comment on column agents.rbmq_vhost is '@ rabbitmq virtual host'; 
comment on column agents.rbmq_encrypted_password is '@ rabbitmq password for the agent: random password hashed using the agent public key'; 

comment on column agents.x is '@ agent x pose - horizontal (unit)';
comment on column agents.y is '@ agent y pose - vertical (unit)';
comment on column agents.z is '@ agent z pose - altitude (unit)';
comment on column agents.orientations is '@ agent orientations (mrad)';
comment on column agents.wp_clearance is '@ agent response for the last request to change its status to "READY" for a specific work process';
comment on column agents.sensors_data_format is '@ JSON data structure for the field sensors';





-- -- High-performance table: No foreign keys are defined in order to reduce the impact in INSERT operations.
CREATE TABLE IF NOT EXISTS public.agent_poses (
    id BIGSERIAL PRIMARY KEY,
    tool_id bigint,
    agent_id bigint,
    yard_id bigint,
    work_process_id bigint,
    x float,
    y float,
    z float,
    orientation float,
    orientations float[],
    sensors jsonb,
    status character varying,
    assignment jsonb,
    created_at timestamp(6) without time zone NOT NULL DEFAULT NOW()
);


comment on column agent_poses.agent_id is '@ agent_id foreign key to agents';
comment on column agent_poses.x is '@ agent x pose in relative yard coordinates (arb unit)';
comment on column agent_poses.y is '@ agent y pose in relative yard coordinates (arb unit)';
comment on column agent_poses.orientation is '@ agent orientation (mrad)';
comment on column agent_poses.sensors is '@ object with sensor data from tool';




