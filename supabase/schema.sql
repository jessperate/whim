-- Whim accounts schema.
-- Run this once in the Supabase SQL editor (Dashboard → SQL → New query → paste → Run).
-- Safe to re-run: tables use IF NOT EXISTS, policies are dropped and recreated.

-- ============================================================
-- profiles — one row per auth user, provisioned by trigger
-- ============================================================
create table if not exists public.profiles (
  user_id      uuid primary key references auth.users(id) on delete cascade,
  username     text not null unique check (username ~ '^[a-z0-9_]{3,20}$'),
  display_name text not null default '',
  ob_step      int  not null default -1,
  ob_answers   jsonb not null default '[]',
  quiz_answers jsonb not null default '{}',
  plan_status  text not null default 'draft' check (plan_status in ('draft','approved')),
  swipe_count  int  not null default 0,
  updated_at   timestamptz not null default now()
);

-- Provision a profile (with a guaranteed-unique username) for every new auth user.
-- Email/password signups pass a chosen username in metadata; OAuth users get one
-- derived from their email prefix, editable later.
create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  base text;
  candidate text;
begin
  base := lower(coalesce(nullif(new.raw_user_meta_data->>'username', ''), split_part(new.email, '@', 1)));
  base := substr(regexp_replace(base, '[^a-z0-9_]', '_', 'g'), 1, 20);
  if length(base) < 3 then
    base := 'whim_' || substr(md5(random()::text), 1, 6);
  end if;
  candidate := base;
  while exists (select 1 from public.profiles where username = candidate) loop
    candidate := substr(base, 1, 14) || '_' || substr(md5(random()::text), 1, 4);
  end loop;
  insert into public.profiles (user_id, username, display_name)
  values (
    new.id,
    candidate,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', '')
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================================
-- user data
-- `place` holds a jsonb snapshot for dynamic (g_*) places so they
-- render on devices that never fetched them from /api/discover.
-- ============================================================
create table if not exists public.swipes (
  user_id    uuid not null references public.profiles(user_id) on delete cascade,
  place_id   text not null,
  direction  text not null check (direction in ('like','nope')),
  place      jsonb,
  created_at timestamptz not null default now(),
  primary key (user_id, place_id)
);

create table if not exists public.hearts (
  user_id    uuid not null references public.profiles(user_id) on delete cascade,
  place_id   text not null,
  place      jsonb,
  created_at timestamptz not null default now(),
  primary key (user_id, place_id)
);

create table if not exists public.reviews (
  user_id    uuid not null references public.profiles(user_id) on delete cascade,
  place_id   text not null,
  stars      int  not null default 5 check (stars between 1 and 5),
  text       text not null check (char_length(text) <= 500),
  created_at timestamptz not null default now(),
  primary key (user_id, place_id)
);

create table if not exists public.friendships (
  requester  uuid not null references public.profiles(user_id) on delete cascade,
  addressee  uuid not null references public.profiles(user_id) on delete cascade,
  status     text not null default 'pending' check (status in ('pending','accepted')),
  created_at timestamptz not null default now(),
  primary key (requester, addressee),
  check (requester <> addressee)
);

-- one relationship per pair, regardless of who asked first
create unique index if not exists friendships_pair
  on public.friendships (least(requester, addressee), greatest(requester, addressee));

-- ============================================================
-- helpers (security definer: they peek across RLS on friendships)
-- ============================================================
-- any link (pending or accepted) between two users
create or replace function public.has_link(a uuid, b uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.friendships
    where (requester = a and addressee = b) or (requester = b and addressee = a)
  );
$$;

-- accepted friendship between two users
create or replace function public.is_friend(a uuid, b uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.friendships
    where status = 'accepted'
      and ((requester = a and addressee = b) or (requester = b and addressee = a))
  );
$$;

-- exact-match username lookup that leaks nothing but the handle
create or replace function public.find_profile(q text)
returns table (user_id uuid, username text, display_name text)
language sql stable security definer set search_path = public
as $$
  select user_id, username, display_name
  from public.profiles
  where username = lower(trim(q))
  limit 1;
$$;

-- ============================================================
-- row level security
-- ============================================================
alter table public.profiles    enable row level security;
alter table public.swipes      enable row level security;
alter table public.hearts      enable row level security;
alter table public.reviews     enable row level security;
alter table public.friendships enable row level security;

-- profiles: readable by yourself and anyone you have a link with
-- (pending included, so request lists can show names). Writable by you only.
-- No insert policy: rows are created by the trigger.
drop policy if exists "profiles select own or linked" on public.profiles;
create policy "profiles select own or linked" on public.profiles
  for select using (auth.uid() = user_id or public.has_link(auth.uid(), user_id));
drop policy if exists "profiles update own" on public.profiles;
create policy "profiles update own" on public.profiles
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- swipes: own CRUD; accepted friends may read likes (not nopes)
drop policy if exists "swipes select own or friend likes" on public.swipes;
create policy "swipes select own or friend likes" on public.swipes
  for select using (auth.uid() = user_id or (direction = 'like' and public.is_friend(auth.uid(), user_id)));
drop policy if exists "swipes insert own" on public.swipes;
create policy "swipes insert own" on public.swipes
  for insert with check (auth.uid() = user_id);
drop policy if exists "swipes update own" on public.swipes;
create policy "swipes update own" on public.swipes
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "swipes delete own" on public.swipes;
create policy "swipes delete own" on public.swipes
  for delete using (auth.uid() = user_id);

-- hearts: own CRUD; accepted friends may read
drop policy if exists "hearts select own or friend" on public.hearts;
create policy "hearts select own or friend" on public.hearts
  for select using (auth.uid() = user_id or public.is_friend(auth.uid(), user_id));
drop policy if exists "hearts insert own" on public.hearts;
create policy "hearts insert own" on public.hearts
  for insert with check (auth.uid() = user_id);
drop policy if exists "hearts update own" on public.hearts;
create policy "hearts update own" on public.hearts
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "hearts delete own" on public.hearts;
create policy "hearts delete own" on public.hearts
  for delete using (auth.uid() = user_id);

-- reviews: own CRUD; accepted friends may read
drop policy if exists "reviews select own or friend" on public.reviews;
create policy "reviews select own or friend" on public.reviews
  for select using (auth.uid() = user_id or public.is_friend(auth.uid(), user_id));
drop policy if exists "reviews insert own" on public.reviews;
create policy "reviews insert own" on public.reviews
  for insert with check (auth.uid() = user_id);
drop policy if exists "reviews update own" on public.reviews;
create policy "reviews update own" on public.reviews
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "reviews delete own" on public.reviews;
create policy "reviews delete own" on public.reviews
  for delete using (auth.uid() = user_id);

-- friendships: both parties read; requester creates pending; addressee accepts;
-- either side deletes (decline, cancel, unfriend)
drop policy if exists "friendships select party" on public.friendships;
create policy "friendships select party" on public.friendships
  for select using (auth.uid() = requester or auth.uid() = addressee);
drop policy if exists "friendships insert requester" on public.friendships;
create policy "friendships insert requester" on public.friendships
  for insert with check (auth.uid() = requester and status = 'pending');
drop policy if exists "friendships update addressee" on public.friendships;
create policy "friendships update addressee" on public.friendships
  for update using (auth.uid() = addressee) with check (auth.uid() = addressee);
drop policy if exists "friendships delete party" on public.friendships;
create policy "friendships delete party" on public.friendships
  for delete using (auth.uid() = requester or auth.uid() = addressee);

-- ============================================================
-- privileges (RLS filters rows; grants gate the verbs)
-- ============================================================
grant usage on schema public to authenticated;
grant select, insert, update, delete
  on public.profiles, public.swipes, public.hearts, public.reviews, public.friendships
  to authenticated;
revoke all on public.profiles, public.swipes, public.hearts, public.reviews, public.friendships from anon;
grant execute on function public.is_friend(uuid, uuid), public.has_link(uuid, uuid), public.find_profile(text) to authenticated;
revoke execute on function public.find_profile(text) from anon, public;
