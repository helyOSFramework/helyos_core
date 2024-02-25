 

--  No Foreign Keys defined for this table.
CREATE TABLE IF NOT EXISTS public.instant_actions (
    id BIGSERIAL PRIMARY KEY,
    yard_id bigint,
    agent_id bigint,
    agent_uuid character varying,
    sender character varying,
    command character varying,
    result character varying,
    status character varying,
    error character varying,
    created_at timestamp(6) without time zone  NOT NULL DEFAULT NOW()
);



comment on column instant_actions.yard_id is '@ yard ID where assignment should be performed';
comment on column instant_actions.agent_id is '@ agent for which assignment is assigned';
comment on column instant_actions.command is '@ string for command';
comment on column instant_actions.status is '@ status of assignment: "to_dispatch", "executing", "succeeded", "failed", "canceled"';



