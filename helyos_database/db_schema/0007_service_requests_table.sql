CREATE TABLE IF NOT EXISTS public.service_requests (
  id BIGSERIAL PRIMARY KEY,
  work_process_id BIGINT REFERENCES public.work_processes(id) ON DELETE SET NULL,
  request JSONB,
  config JSONB,
  response JSONB,
  service_type CHARACTER VARYING,
  service_url CHARACTER VARYING,
  service_queue_id CHARACTER VARYING,
  result_timeout INTEGER DEFAULT 180,

  -- Context data with yard state
  context JSONB,
  require_agents_data BOOLEAN DEFAULT TRUE,
  require_mission_agents_data BOOLEAN DEFAULT TRUE,
  require_map_data BOOLEAN DEFAULT TRUE,
  require_map_objects TEXT[],
  agent_ids INTEGER[],

  -- For planning services
  step CHARACTER VARYING,
  request_uid CHARACTER VARYING,
  next_request_to_dispatch_uid CHARACTER VARYING,
  next_request_to_dispatch_uids TEXT[],
  next_step TEXT[],
  depend_on_requests TEXT[],
  is_result_assignment BOOLEAN,
  wait_dependencies_assignments BOOLEAN,
  start_at TIMESTAMP(6) WITHOUT TIME ZONE NOT NULL DEFAULT NOW(),
  assignment_dispatched BOOLEAN,

  status CHARACTER VARYING,
  fetched BOOLEAN,
  processed BOOLEAN,
  canceled BOOLEAN,
  dispatched_at TIMESTAMP(6) WITHOUT TIME ZONE,
  result_at TIMESTAMP(6) WITHOUT TIME ZONE,
  created_at TIMESTAMP(6) WITHOUT TIME ZONE NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMP(6) WITHOUT TIME ZONE,
  modified_at TIMESTAMP(6) WITHOUT TIME ZONE NOT NULL DEFAULT NOW()
);

COMMENT ON COLUMN service_requests.request IS '@ request object';
COMMENT ON COLUMN service_requests.context IS '@ context object';
COMMENT ON COLUMN service_requests.response IS '@ result object';
COMMENT ON COLUMN service_requests.service_queue_id IS '@ request id provided by web service';
COMMENT ON COLUMN service_requests.status IS '@ status of service request: "not_ready_for_service", "ready_for_service", "pending", "ready"';
COMMENT ON COLUMN service_requests.fetched IS '@ shows if request has been sent to service';
COMMENT ON COLUMN service_requests.processed IS '@ shows if result is received from service';
COMMENT ON COLUMN service_requests.canceled IS '@ field to cancel service request';