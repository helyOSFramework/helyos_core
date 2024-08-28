 



CREATE TABLE IF NOT EXISTS public.assignments (
    id BIGSERIAL PRIMARY KEY,
    yard_id bigint REFERENCES public.yards(id) ON DELETE SET NULL,
    work_process_id bigint REFERENCES public.work_processes(id) ON DELETE CASCADE,
    agent_id bigint REFERENCES public.agents(id) ON DELETE SET NULL,
    service_request_id bigint REFERENCES public.service_requests(id) ON DELETE SET NULL,

    data jsonb,
    context jsonb,
    result jsonb,
    status character varying,
    start_time_stamp character varying,
    depend_on_assignments bigint[],
    next_assignments bigint[],
    error character varying,
    created_at timestamp(6) without time zone  NOT NULL DEFAULT NOW(),
    modified_at timestamp(6) without time zone NOT NULL DEFAULT NOW(),
    on_assignment_failure character varying DEFAULT 'DEFAULT' CHECK (on_assignment_failure IN ('DEFAULT','FAIL_MISSION', 'CONTINUE_MISSION', 'RELEASE_FAILED')),
    fallback_mission character varying DEFAULT 'DEFAULT',
    
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


comment on column assignments.yard_id is '@ yard ID where assignment should be performed';
comment on column assignments.work_process_id is '@ corresponding work process';
-- comment on column assignments.action_id is '@ correponding action';
comment on column assignments.agent_id is '@ agent for which assignment is assigned';
comment on column assignments.data is '@ json-object for assignment';
comment on column assignments.status is '@ status of assignment: "to_dispatch", "executing", "succeeded", "failed", "canceled"';
-- @TODO CARLOS change "execute" to "sent"














