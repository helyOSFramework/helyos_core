 


CREATE TABLE IF NOT EXISTS public.users (
    id BIGSERIAL PRIMARY KEY,
    email character varying DEFAULT ''::character varying NOT NULL,
    reset_password_token character varying,
    reset_password_sent_at timestamp without time zone,
    remember_created_at timestamp without time zone,
    sign_in_count integer DEFAULT 0 NOT NULL,
    current_sign_in_at timestamp without time zone,
    last_sign_in_at timestamp without time zone,
    current_sign_in_ip inet,
    last_sign_in_ip inet,
    created_at timestamp without time zone NOT NULL DEFAULT NOW(),
    modified_at timestamp without time zone,
    name character varying,
    metadata json,
    role integer
);



CREATE TABLE IF NOT EXISTS public.user_account (
  id BIGSERIAL PRIMARY KEY,
  user_id        integer references public.users(id) on delete cascade,
  username       character varying DEFAULT ''::character varying NOT NULL,
  created_at timestamp without time zone NOT NULL DEFAULT NOW(),
  modified_at timestamp without time zone,
  description character varying, 
  metadata json,

  email            text,
  password_hash    text not null,
  user_role integer,
  UNIQUE(username)
);



CREATE INDEX index_users_on_reset_password_token ON public.users USING btree (reset_password_token);



