-- No Foreign Keys defined for this table.
CREATE TABLE IF NOT EXISTS public.instant_actions (
  id BIGSERIAL PRIMARY KEY,
  yard_id BIGINT,
  agent_id BIGINT,
  agent_uuid CHARACTER VARYING,
  sender CHARACTER VARYING,
  command CHARACTER VARYING,
  result CHARACTER VARYING,
  status CHARACTER VARYING,
  error CHARACTER VARYING,
  created_at TIMESTAMP(6) WITHOUT TIME ZONE NOT NULL DEFAULT NOW()
);

COMMENT ON COLUMN instant_actions.yard_id IS '@ yard ID where assignment should be performed';
COMMENT ON COLUMN instant_actions.agent_id IS '@ agent for which assignment is assigned';
COMMENT ON COLUMN instant_actions.command IS '@ string for command';
COMMENT ON COLUMN instant_actions.status IS '@ status of assignment: "to_dispatch", "executing", "succeeded", "failed", "canceled"';