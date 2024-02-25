
-------------------
-- REGISTER USER --
-------------------
CREATE OR REPLACE FUNCTION  public.register_user(
  name text,
  username text,
  password text,
  admin_password text
) RETURNS public.users as $$
DECLARE
  new_user public.users;
  admin_account public.user_account;
BEGIN
  select a.* into admin_account from public.user_account as a WHERE a.username = 'admin';

  IF admin_account.password_hash = crypt(admin_password, admin_account.password_hash) then

      insert into public.users (name, email, role) values (name, username, 1)
      returning * into new_user;

      insert into public.user_account (user_id, username, user_role, password_hash) values
        (new_user.id, username, 1, crypt(password, gen_salt('bf')));
      return new_user;

  ELSE
    RAISE EXCEPTION SQLSTATE '90001' USING MESSAGE = 'Incorrect admin password' ;
  END IF;
END
$$ language plpgsql strict security definer;

comment on function public.register_user(text, text, text,text) is 'Registers a single user and creates an account.';



---------------------
-- CHANGE PASSWORD --
---------------------

-------------------
CREATE OR REPLACE FUNCTION  public.admin_change_password(
  username text,
  password text
) RETURNS int as $$

DECLARE
  account public.user_account;
  v_RowCountInt int;
BEGIN

  IF username = 'admin' then
    RAISE EXCEPTION SQLSTATE '90002' USING MESSAGE = 'Please use the procedure change_password(admin, new_password, current_password)' ;
  END IF;

  update  public.user_account as A set password_hash = crypt(password, gen_salt('bf')) where A.username=$1;
  GET DIAGNOSTICS v_RowCountInt = ROW_COUNT;
  IF v_RowCountInt = 0 then 
    RAISE EXCEPTION SQLSTATE '90002' USING MESSAGE = 'username not found' ;
  END IF;

  return 0;

END
$$ language plpgsql strict security definer;

comment on function public.admin_change_password(text,text) is 'Admin changes regular user passwords.';


CREATE OR REPLACE FUNCTION  public.change_password(
  username text,
  new_password text,
  current_password text
) RETURNS public.users as $$
DECLARE
  updated_user public.users;
  account public.user_account;
BEGIN
  select a.* into account from public.user_account as a  where a.username = $1;
  IF account.password_hash = crypt(current_password, account.password_hash) then
      update public.user_account SET password_hash = crypt(new_password, gen_salt('bf')) where user_id = account.user_id;
      return updated_user;
  ELSE
     RAISE EXCEPTION SQLSTATE '90003' USING MESSAGE = 'username or password not correct';
  END IF;
END
$$ language plpgsql strict security definer;

comment on function public.change_password(text, text, text) is 'Update password.';


---------------------
-- AUTHENTICATION --
---------------------

CREATE type public.jwt_token as (
  role text,
  person_id integer,
  exp int
);


CREATE OR REPLACE FUNCTION public.admin_get_user_authtoken(
  username text
) RETURNS public.jwt_token as $$
DECLARE
  account public.user_account;
BEGIN
  select a.* into account
  from public.user_account as a
  where (a.email = $1 or a.username = $1);

  IF account.user_role = 0 then
        return ('role_admin', account.user_id, extract(epoch from now() + interval '365 days'))::public.jwt_token;
  END IF; 
  IF account.user_role = 1 then
        return ('role_application', account.user_id, extract(epoch from now() + interval '365 days'))::public.jwt_token;
  END IF;
  IF account.user_role = 2 then
        return ('role_visualization', account.user_id, extract(epoch from now() + interval '365 days'))::public.jwt_token;
  END IF;
END
$$ language plpgsql strict security definer;

comment on function public.admin_get_user_authtoken(text) is 'Creates a JWT token that will securely identify a person and give them certain permissions. This token expires in 7 days.';



CREATE OR REPLACE FUNCTION public.authenticate(
  username text,
  password text
) RETURNS public.jwt_token as $$
DECLARE
  account public.user_account;
BEGIN
  select a.* into account
  from public.user_account as a
  where (a.email = $1 or a.username = $1);

  IF account.password_hash = crypt(password, account.password_hash) then
    IF account.user_role = 0 then
          return ('role_admin', account.user_id, extract(epoch from now() + interval '7 days'))::public.jwt_token;
    ELSE
          return ('role_application', account.user_id, extract(epoch from now() + interval '7 days'))::public.jwt_token;
    END IF;
  ELSE
    return "'null'";
  END IF;
END
$$ language plpgsql strict security definer;

comment on function public.authenticate(text, text) is 'Creates a JWT token that will securely identify a person and give them certain permissions. This token expires in 7 days.';



CREATE OR REPLACE FUNCTION public.logout(
-- this functions is not checking IF the requester is the owner of the email
  username text
) RETURNS public.jwt_token as $$
DECLARE
  account public.user_account;
BEGIN
  select a.* into account
  from public.user_account as a
  where a.email = $1 or a.username = $1;
  return ('role_application', account.user_id, extract(epoch from now() + interval '1 minute'))::public.jwt_token;
END
$$ language plpgsql strict security definer;

comment on function public.logout(text) is 'Creates a JWT token that will substitute the previous token.';


GRANT EXECUTE ON FUNCTION public.authenticate TO role_application, role_admin, role_anonymous,role_postgraphile; 
GRANT EXECUTE ON FUNCTION public.change_password TO role_application, role_admin, role_anonymous,role_postgraphile; 

GRANT EXECUTE ON FUNCTION public.admin_change_password TO  role_admin, role_postgraphile; 
GRANT EXECUTE ON FUNCTION public.admin_get_user_authtoken TO  role_admin, role_postgraphile; 
GRANT EXECUTE ON FUNCTION public.register_user TO  role_admin, role_postgraphile; 


GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO role_application, role_admin, role_postgraphile;