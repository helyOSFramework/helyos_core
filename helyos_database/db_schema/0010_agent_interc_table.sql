 

CREATE TABLE IF NOT EXISTS public.agents_interconnections (
    id BIGSERIAL PRIMARY KEY,
    leader_id bigint,
    follower_id bigint,
    connection_geometry jsonb,
    created_at timestamp(6) without time zone NOT NULL DEFAULT NOW(),

    CONSTRAINT fk_leader_id FOREIGN KEY (leader_id)
        REFERENCES public.agents (id) MATCH SIMPLE
        ON DELETE CASCADE,

    CONSTRAINT fk_follower_id FOREIGN KEY (follower_id)
        REFERENCES public.agents (id) MATCH SIMPLE
        ON DELETE CASCADE,
    UNIQUE(leader_id, follower_id)
);


comment on column agents_interconnections.leader_id is '@  leading, usually owns a computer for interface';
comment on column agents_interconnections.follower_id is '@  follower, e.g. trailer';
comment on column agents_interconnections.connection_geometry is '@  connection_geometry data';
