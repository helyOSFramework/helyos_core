-------------------
-- REGISTER USER --
-------------------
CREATE OR REPLACE FUNCTION public.register_user(
  name TEXT,
  username TEXT,
  password TEXT,
  admin_password TEXT
) RETURNS public.users AS $$
DECLARE
  new_user public.users;
  admin_account public.user_account;
BEGIN
  SELECT a.* INTO admin_account FROM public.user_account AS a WHERE a.username = 'admin';

  IF admin_account.password_hash = crypt(admin_password, admin_account.password_hash) THEN
    INSERT INTO public.users (name, email, role) VALUES (name, username, 1)
    RETURNING * INTO new_user;

    INSERT INTO public.user_account (user_id, username, user_role, password_hash) VALUES
      (new_user.id, username, 1, crypt(password, gen_salt('bf')));
    RETURN new_user;

  ELSE
    RAISE EXCEPTION SQLSTATE '90001' USING MESSAGE = 'Incorrect admin password';
  END IF;
END
$$ LANGUAGE plpgsql STRICT SECURITY DEFINER;

COMMENT ON FUNCTION public.register_user(TEXT, TEXT, TEXT, TEXT) IS 'Registers a single user and creates an account.';

---------------------
-- CHANGE PASSWORD --
---------------------

CREATE OR REPLACE FUNCTION public.admin_change_password(
  username TEXT,
  password TEXT
) RETURNS INT AS $$
DECLARE
  account public.user_account;
  v_RowCountInt INT;
BEGIN
  IF username = 'admin' THEN
    RAISE EXCEPTION SQLSTATE '90002' USING MESSAGE = 'Please use the procedure change_password(admin, new_password, current_password)';
  END IF;

  UPDATE public.user_account AS A SET password_hash = crypt(password, gen_salt('bf')) WHERE A.username = $1;
  GET DIAGNOSTICS v_RowCountInt = ROW_COUNT;
  IF v_RowCountInt = 0 THEN 
    RAISE EXCEPTION SQLSTATE '90002' USING MESSAGE = 'username not found';
  END IF;

  RETURN 0;
END
$$ LANGUAGE plpgsql STRICT SECURITY DEFINER;

COMMENT ON FUNCTION public.admin_change_password(TEXT, TEXT) IS 'Admin changes regular user passwords.';



CREATE OR REPLACE FUNCTION public.change_password(
  username TEXT,
  new_password TEXT,
  current_password TEXT
) RETURNS public.users AS $$
DECLARE
  updated_user public.users;
  account public.user_account;
BEGIN
  SELECT a.* INTO account FROM public.user_account AS a WHERE a.username = $1;
  IF account.password_hash = crypt(current_password, account.password_hash) THEN
    UPDATE public.user_account SET password_hash = crypt(new_password, gen_salt('bf')) WHERE user_id = account.user_id;
    RETURN updated_user;
  ELSE
    RAISE EXCEPTION SQLSTATE '90003' USING MESSAGE = 'username or password not correct';
  END IF;
END
$$ LANGUAGE plpgsql STRICT SECURITY DEFINER;

COMMENT ON FUNCTION public.change_password(TEXT, TEXT, TEXT) IS 'Update password.';

---------------------
-- AUTHENTICATION --
---------------------

CREATE TYPE public.jwt_token AS (
  role TEXT,
  person_id INTEGER,
  exp INT
);

CREATE OR REPLACE FUNCTION public.admin_get_user_authtoken(
  username TEXT
) RETURNS public.jwt_token AS $$
DECLARE
  account public.user_account;
BEGIN
  SELECT a.* INTO account
  FROM public.user_account AS a
  WHERE (a.email = $1 OR a.username = $1);

  IF account.user_role = 0 THEN
    RETURN ('role_admin', account.user_id, extract(epoch FROM now() + interval '365 days'))::public.jwt_token;
  END IF; 
  IF account.user_role = 1 THEN
    RETURN ('role_application', account.user_id, extract(epoch FROM now() + interval '365 days'))::public.jwt_token;
  END IF;
  IF account.user_role = 2 THEN
    RETURN ('role_visualization', account.user_id, extract(epoch FROM now() + interval '365 days'))::public.jwt_token;
  END IF;
END
$$ LANGUAGE plpgsql STRICT SECURITY DEFINER;

COMMENT ON FUNCTION public.admin_get_user_authtoken(TEXT) IS 'Creates a JWT token that will securely identify a person and give them certain permissions. This token expires in 365 days.';



CREATE OR REPLACE FUNCTION public.authenticate(
  username TEXT,
  password TEXT
) RETURNS public.jwt_token AS $$
DECLARE
  account public.user_account;
BEGIN
  SELECT a.* INTO account
  FROM public.user_account AS a
  WHERE (a.email = $1 OR a.username = $1);

  IF account.password_hash = crypt(password, account.password_hash) THEN
    IF account.user_role = 0 THEN
      RETURN ('role_admin', account.user_id, extract(epoch FROM now() + interval '7 days'))::public.jwt_token;
    ELSE
      RETURN ('role_application', account.user_id, extract(epoch FROM now() + interval '7 days'))::public.jwt_token;
    END IF;
  ELSE
    RETURN "'null'";
  END IF;
END
$$ LANGUAGE plpgsql STRICT SECURITY DEFINER;

COMMENT ON FUNCTION public.authenticate(TEXT, TEXT) IS 'Creates a JWT token that will securely identify a person and give them certain permissions. This token expires in 7 days.';



CREATE OR REPLACE FUNCTION public.logout(
  -- this function is not checking IF the requester is the owner of the email
  username TEXT
) RETURNS public.jwt_token AS $$
DECLARE
  account public.user_account;
BEGIN
  SELECT a.* INTO account
  FROM public.user_account AS a
  WHERE a.email = $1 OR a.username = $1;
  RETURN ('role_application', account.user_id, extract(epoch FROM now() + interval '1 minute'))::public.jwt_token;
END
$$ LANGUAGE plpgsql STRICT SECURITY DEFINER;

COMMENT ON FUNCTION public.logout(TEXT) IS 'Creates a JWT token that will substitute the previous token.';

GRANT EXECUTE ON FUNCTION public.authenticate TO role_application, role_admin, role_anonymous, role_postgraphile; 
GRANT EXECUTE ON FUNCTION public.change_password TO role_application, role_admin, role_anonymous, role_postgraphile; 
GRANT EXECUTE ON FUNCTION public.admin_change_password TO role_admin, role_postgraphile; 
GRANT EXECUTE ON FUNCTION public.admin_get_user_authtoken TO role_admin, role_postgraphile; 
GRANT EXECUTE ON FUNCTION public.register_user TO role_admin, role_postgraphile; 
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO role_application, role_admin, role_postgraphile;