CREATE TABLE IF NOT EXISTS public.agents_interconnections (
  id BIGSERIAL PRIMARY KEY,
  leader_id BIGINT,
  follower_id BIGINT,
  connection_geometry JSONB,
  created_at TIMESTAMP(6) WITHOUT TIME ZONE NOT NULL DEFAULT NOW(),

  CONSTRAINT fk_leader_id FOREIGN KEY (leader_id)
    REFERENCES public.agents (id) MATCH SIMPLE
    ON DELETE CASCADE,

  CONSTRAINT fk_follower_id FOREIGN KEY (follower_id)
    REFERENCES public.agents (id) MATCH SIMPLE
    ON DELETE CASCADE,
  UNIQUE(leader_id, follower_id)
);

COMMENT ON COLUMN agents_interconnections.leader_id IS '@ leading, usually owns a computer for interface';
COMMENT ON COLUMN agents_interconnections.follower_id IS '@ follower, e.g. trailer';
COMMENT ON COLUMN agents_interconnections.connection_geometry IS '@ connection_geometry data';