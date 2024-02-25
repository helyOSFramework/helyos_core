#!/bin/bash

# Connect to the PostgreSQL database and execute the SQL code
psql -U "$PGUSER" --dbname="$PGDATABASE" <<EOF

DO \$\$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.users WHERE name = 'admin') THEN
    INSERT INTO public.users (id, name, role)  
    VALUES (1,'admin', 0);

    INSERT INTO public.user_account (user_id,
      username, email, user_role,password_hash ) 
    VALUES (
      (SELECT id FROM public.users WHERE name = 'admin' ORDER BY id DESC LIMIT 1),
      'admin', 'admin', 0, crypt('admin', gen_salt('bf')) );

    PERFORM pg_catalog.setval('public.users_id_seq', 10, true);
    PERFORM pg_catalog.setval('public.user_account_id_seq', 10, true);
  END IF;
END \$\$;

EOF


psql -U "$PGUSER" --dbname="$PGDATABASE" -c "CREATE ROLE role_postgraphile WITH LOGIN PASSWORD'$PGPASSWORD';" || true;
