-- CarVision — Login/Parol autentifikatsiyasi, rollar va Seller panel migratsiyasi
begin;

create extension if not exists citext with schema extensions;

-- ---------------------------------------------------- 1. users jadvaliga ustunlar
alter table users
  add column if not exists login               citext,
  add column if not exists password_hash       text,
  add column if not exists is_active           boolean not null default true,
  add column if not exists password_changed_at timestamptz,
  add column if not exists last_login_at       timestamptz;

-- eski foydalanuvchilar uchun placeholder login
update users set login = 'legacy_' || substr(id::text, 1, 8) where login is null;

alter table users alter column login set not null;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'users_login_key') then
    alter table users add constraint users_login_key unique (login);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'users_login_format') then
    alter table users add constraint users_login_format check (login::text ~ '^[a-z][a-z0-9_.]{2,31}$');
  end if;
  if not exists (select 1 from pg_constraint where conname = 'users_name_len') then
    alter table users add constraint users_name_len check (name is null or char_length(name) between 2 and 60);
  end if;
end $$;

alter table users drop column if exists telegram_id;
alter table users drop column if exists username;

-- ----------------------------------------------------------- 2. rol o'zgarmasligi
create or replace function users_role_immutable() returns trigger language plpgsql as $$
begin
  if new.role is distinct from old.role then
    raise exception 'ROLE_IMMUTABLE';
  end if;
  return new;
end $$;

drop trigger if exists users_role_immutable on users;
create trigger users_role_immutable before update of role on users
  for each row execute function users_role_immutable();

-- ------------------------------------------------------------------- 3. sessions
create table if not exists sessions (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references users(id) on delete cascade,
  token_hash   bytea not null unique,
  created_at   timestamptz not null default now(),
  last_used_at timestamptz not null default now(),
  expires_at   timestamptz not null,
  revoked_at   timestamptz,
  user_agent   text,
  ip           inet
);

create index if not exists sessions_user_idx on sessions (user_id) where revoked_at is null;
create index if not exists sessions_expiry_idx on sessions (expires_at);

-- ------------------------------------------------------------- 4. login_attempts
create table if not exists login_attempts (
  id         bigint generated always as identity primary key,
  kind       text not null check (kind in ('login','register')),
  login_key  citext,
  ip         inet not null,
  success    boolean not null,
  created_at timestamptz not null default now()
);

create index if not exists login_attempts_login_idx on login_attempts (kind, login_key, created_at desc);
create index if not exists login_attempts_ip_idx    on login_attempts (kind, ip, created_at desc);

-- ------------------------------------------------------------------------ 5. RLS
alter table users          enable row level security;
alter table sessions       enable row level security;
alter table login_attempts enable row level security;

-- Siyosat YO'Q = anon/authenticated uchun yopiq. Backend SECRET (service) kalit
-- bilan RLS'ni chetlab o'tadi. (Avval bu yerda "using (true)" siyosati bor edi —
-- u parol xeshlari va sessiyalarni hamma uchun ochib qo'yardi; 0002 uni yopadi.)
drop policy if exists "users public all"          on users;
drop policy if exists "sessions public all"       on sessions;
drop policy if exists "login_attempts public all" on login_attempts;
revoke all on users, sessions, login_attempts from anon, authenticated;

-- ---------------------------------------------------------- 6. public_sellers view
drop view if exists public_sellers;
create or replace view public_sellers with (security_invoker = false) as
  select id, business_name, verified, phone from sellers;

grant select on public_sellers to anon, authenticated;

-- ---------------------------------------------------------- 7. RPC funksiyalari
create or replace function register_account(
  p_login citext,
  p_password_hash text,
  p_name text,
  p_role user_role,
  p_business_name text default null,
  p_phone text default null,
  p_address text default null
) returns users language plpgsql as $$
declare
  v_user users;
begin
  if p_role = 'admin' then
    raise exception 'INVALID_ROLE';
  end if;

  if exists (select 1 from users where login = p_login) then
    raise exception 'LOGIN_TAKEN';
  end if;

  insert into users (login, password_hash, name, role)
  values (p_login, p_password_hash, p_name, p_role)
  returning * into v_user;

  if p_role = 'seller' then
    if p_business_name is null or length(trim(p_business_name)) < 2 then
      raise exception 'INVALID_BUSINESS_NAME';
    end if;
    insert into sellers (user_id, business_name, phone, address, credits)
    values (v_user.id, trim(p_business_name), p_phone, p_address, 3);
  end if;

  return v_user;
end $$;

create or replace function consume_seller_credit(p_seller uuid) returns int language plpgsql as $$
declare
  v_rem int;
begin
  update sellers set credits = credits - 1 where id = p_seller and credits >= 1 returning credits into v_rem;
  if v_rem is null then
    raise exception 'NO_CREDITS';
  end if;
  insert into seller_credit_transactions (seller_id, type, amount) values (p_seller, 'consume', -1);
  return v_rem;
end $$;

create or replace function refund_seller_credit(p_seller uuid) returns int language plpgsql as $$
declare
  v_rem int;
begin
  update sellers set credits = credits + 1 where id = p_seller returning credits into v_rem;
  insert into seller_credit_transactions (seller_id, type, amount) values (p_seller, 'refund', 1);
  return v_rem;
end $$;

create or replace function add_seller_credits(p_seller uuid, p_amount int, p_package text) returns int language plpgsql as $$
declare
  v_rem int;
begin
  update sellers set credits = credits + p_amount where id = p_seller returning credits into v_rem;
  insert into seller_credit_transactions (seller_id, type, amount, package_id) values (p_seller, 'purchase', p_amount, p_package);
  return v_rem;
end $$;

create or replace function set_order_status(p_order uuid, p_seller uuid, p_next order_status) returns orders language plpgsql as $$
declare
  v_order orders;
  v_item record;
begin
  select * into v_order from orders where id = p_order and seller_id = p_seller for update;
  if v_order is null then
    raise exception 'ORDER_NOT_FOUND';
  end if;

  if v_order.status = 'completed' or v_order.status = 'cancelled' then
    raise exception 'INVALID_TRANSITION';
  end if;

  update orders set status = p_next, updated_at = now() where id = p_order returning * into v_order;

  if p_next = 'cancelled' then
    for v_item in select product_id, quantity from order_items where order_id = p_order loop
      update products set stock = stock + v_item.quantity where id = v_item.product_id;
    end loop;
  end if;

  return v_order;
end $$;

create or replace function cancel_own_order(p_order uuid, p_user uuid) returns orders language plpgsql as $$
declare
  v_order orders;
  v_item record;
begin
  select * into v_order from orders where id = p_order and user_id = p_user for update;
  if v_order is null then
    raise exception 'ORDER_NOT_FOUND';
  end if;

  if v_order.status != 'new' then
    raise exception 'NOT_CANCELLABLE';
  end if;

  update orders set status = 'cancelled', updated_at = now() where id = p_order returning * into v_order;

  for v_item in select product_id, quantity from order_items where order_id = p_order loop
    update products set stock = stock + v_item.quantity where id = v_item.product_id;
  end loop;

  return v_order;
end $$;

commit;
