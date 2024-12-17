CREATE TABLE IF NOT EXISTS public.users (
  id BIGSERIAL PRIMARY KEY,
  email CHARACTER VARYING DEFAULT ''::CHARACTER VARYING NOT NULL,
  reset_password_token CHARACTER VARYING,
  reset_password_sent_at TIMESTAMP WITHOUT TIME ZONE,
  remember_created_at TIMESTAMP WITHOUT TIME ZONE,
  sign_in_count INTEGER DEFAULT 0 NOT NULL,
  current_sign_in_at TIMESTAMP WITHOUT TIME ZONE,
  last_sign_in_at TIMESTAMP WITHOUT TIME ZONE,
  current_sign_in_ip INET,
  last_sign_in_ip INET,
  created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT NOW(),
  modified_at TIMESTAMP WITHOUT TIME ZONE,
  name CHARACTER VARYING,
  metadata JSON,
  role INTEGER
);

CREATE TABLE IF NOT EXISTS public.user_account (
  id BIGSERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES public.users(id) ON DELETE CASCADE,
  username CHARACTER VARYING DEFAULT ''::CHARACTER VARYING NOT NULL,
  created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT NOW(),
  modified_at TIMESTAMP WITHOUT TIME ZONE,
  description CHARACTER VARYING,
  metadata JSON,
  email TEXT,
  password_hash TEXT NOT NULL,
  user_role INTEGER,
  UNIQUE(username)
);

CREATE INDEX index_users_on_reset_password_token ON public.users USING btree (reset_password_token);