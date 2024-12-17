CREATE TABLE IF NOT EXISTS public.assignments (
  id BIGSERIAL PRIMARY KEY,
  yard_id BIGINT REFERENCES public.yards(id) ON DELETE SET NULL,
  work_process_id BIGINT REFERENCES public.work_processes(id) ON DELETE CASCADE,
  agent_id BIGINT REFERENCES public.agents(id) ON DELETE SET NULL,
  service_request_id BIGINT REFERENCES public.service_requests(id) ON DELETE SET NULL,

  data JSONB,
  context JSONB,
  result JSONB,
  status CHARACTER VARYING,
  start_time_stamp CHARACTER VARYING,
  depend_on_assignments BIGINT[],
  next_assignments BIGINT[],
  error CHARACTER VARYING,
  created_at TIMESTAMP(6) WITHOUT TIME ZONE NOT NULL DEFAULT NOW(),
  modified_at TIMESTAMP(6) WITHOUT TIME ZONE NOT NULL DEFAULT NOW(),
  on_assignment_failure CHARACTER VARYING DEFAULT 'DEFAULT' CHECK (on_assignment_failure IN ('DEFAULT', 'FAIL_MISSION', 'CONTINUE_MISSION', 'RELEASE_FAILED')),
  fallback_mission CHARACTER VARYING DEFAULT 'DEFAULT',

  CONSTRAINT status_check CHECK (
    status IS NULL OR
    status IN (
      'to_dispatch',
      'executing',
      'succeeded',
      'completed',
      'rejected',
      'failed',
      'aborted',
      'canceling',
      'canceled',
      'wait_dependencies',
      'not_ready_to_dispatch',
      'active'
    )
  )
);

COMMENT ON COLUMN assignments.yard_id IS '@ yard ID where assignment should be performed';
COMMENT ON COLUMN assignments.work_process_id IS '@ corresponding work process';
-- COMMENT ON COLUMN assignments.action_id IS '@ corresponding action';
COMMENT ON COLUMN assignments.agent_id IS '@ agent for which assignment is assigned';
COMMENT ON COLUMN assignments.data IS '@ json-object for assignment';
COMMENT ON COLUMN assignments.status IS '@ status of assignment: "to_dispatch", "executing", "succeeded", "failed", "canceled"';