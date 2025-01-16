CREATE TABLE IF NOT EXISTS public.system_logs (
  id BIGSERIAL PRIMARY KEY,
  created_at TIMESTAMP(6) WITHOUT TIME ZONE DEFAULT NOW(),
  yard_id BIGINT,
  wproc_id BIGINT,
  agent_uuid CHARACTER VARYING,
  service_type CHARACTER VARYING,
  event CHARACTER VARYING,
  origin CHARACTER VARYING,
  log_type CHARACTER VARYING,
  collected BOOLEAN,
  msg CHARACTER VARYING
);

COMMENT ON COLUMN system_logs.collected IS '@ if log was sent to a log collector service';
COMMENT ON COLUMN system_logs.msg IS '@ log message.';
COMMENT ON COLUMN system_logs.origin IS '@ "microservice" | "agent" | "app" | "database"';
COMMENT ON COLUMN system_logs.event IS '@ "send to microservice" | "get from microservice" | "send to agent" | "get from agent" | "service unhealthy"';
COMMENT ON COLUMN system_logs.log_type IS '@ "error" | "warning" | "normal"';