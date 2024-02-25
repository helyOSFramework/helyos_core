 



CREATE TABLE IF NOT EXISTS public.service_requests (
    id BIGSERIAL PRIMARY KEY,
    work_process_id bigint REFERENCES public.work_processes(id) ON DELETE SET NULL,
    request jsonb,
    config jsonb,
    response jsonb,
    service_type character varying,
    service_url  character varying,
    service_queue_id character varying,
    result_timeout integer DEFAULT 180,

 -- Context data with yard state
    context jsonb,
    require_agents_data boolean DEFAULT true,
    require_mission_agents_data boolean DEFAULT true,
    require_map_data boolean DEFAULT true,
    tool_ids integer[],
    agent_ids integer[],

 -- For DEBUG purposes
    step character varying,

 -- For plannig services
    request_uid character varying,
    next_request_to_dispatch_uid character varying,
    next_request_to_dispatch_uids text[],
    next_step text[],
    depend_on_requests text[],
    is_result_assignment boolean,
    wait_dependencies_assignments boolean,
    start_at timestamp(6) without time zone NOT NULL DEFAULT NOW(),
    assignment_dispatched boolean,
 -- 

    status character varying,
    fetched boolean,
    processed boolean,    
    canceled boolean,    
    dispatched_at timestamp(6) without time zone,
    result_at timestamp(6) without time zone,
    created_at timestamp(6) without time zone NOT NULL DEFAULT NOW(),
    deleted_at timestamp(6) without time zone,
    modified_at timestamp(6) without time zone NOT NULL DEFAULT NOW() 
    );



comment on column service_requests.request is '@ request object';
comment on column service_requests.context is '@ context object';
comment on column service_requests.response is '@ result object';
comment on column service_requests.service_queue_id is '@ request id provided by web service';
comment on column service_requests.status is '@ status of service request: "not_ready_for_service", "ready_for_service", "pending", "ready"';
comment on column service_requests.fetched is '@ shows if request has been send to service';
comment on column service_requests.processed is '@ shows if result is received from service';
comment on column service_requests.canceled is '@ field to cancel service request';

