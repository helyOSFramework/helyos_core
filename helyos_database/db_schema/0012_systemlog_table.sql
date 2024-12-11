 




CREATE TABLE IF NOT EXISTS public.system_logs (
    id BIGSERIAL PRIMARY KEY,
    created_at timestamp(6) without time zone DEFAULT NOW(),
    yard_id bigint,
    wproc_id bigint,
    agent_uuid character varying,
    service_type  character varying,
    event  character varying,
    origin character varying,
    log_type character varying,
    collected  boolean,
    msg character varying
);

comment on column system_logs.collected is '@ if log was sent to a log collector service';
comment on column system_logs.msg is '@ log message.';
comment on column system_logs.origin is '@ "microservice" | "agent" | "app" | "database"';
comment on column system_logs.event is '@ "send to microservice" | "get from microservice" | "send to agent" | "get from agent" | "service unhealthy"';
comment on column system_logs.log_type is '@ "error" | "warning" | "normal"';

