begin;

create table if not exists public.journal_states (
  user_id uuid primary key references auth.users(id) on delete cascade,
  state jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  username text not null unique check (username ~ '^[A-Za-z0-9_]{3,24}$'),
  onboarding_completed boolean not null default false,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  requested_username text;
begin
  requested_username := lower(coalesce(new.raw_user_meta_data ->> 'username', ''));

  if requested_username !~ '^[a-z0-9_]{3,24}$' then
    requested_username := 'trader_' || substr(new.id::text, 1, 8);
  end if;

  insert into public.profiles (user_id, full_name, username)
  values (
    new.id,
    trim(coalesce(new.raw_user_meta_data ->> 'full_name', '')),
    requested_username
  )
  on conflict (user_id) do update set
    full_name = excluded.full_name,
    username = excluded.username;

  return new;
end;
$$;

insert into public.profiles (user_id, full_name, username, onboarding_completed)
select
  users.id,
  trim(coalesce(users.raw_user_meta_data ->> 'full_name', '')),
  'trader_' || substr(users.id::text, 1, 8),
  false
from auth.users as users
where not exists (
  select 1 from public.profiles as profiles where profiles.user_id = users.id
);

drop trigger if exists set_journal_states_updated_at on public.journal_states;
create trigger set_journal_states_updated_at
before update on public.journal_states
for each row execute function public.set_updated_at();

drop trigger if exists set_profiles_updated_at on public.profiles;
create trigger set_profiles_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

alter table public.journal_states enable row level security;
alter table public.profiles enable row level security;

drop policy if exists "Users can read their own journal" on public.journal_states;
drop policy if exists "Users can create their own journal" on public.journal_states;
drop policy if exists "Users can update their own journal" on public.journal_states;
drop policy if exists "Users can delete their own journal" on public.journal_states;

create policy "Users can read their own journal"
on public.journal_states for select
to authenticated
using ((select auth.uid()) = user_id);

create policy "Users can create their own journal"
on public.journal_states for insert
to authenticated
with check ((select auth.uid()) = user_id);

create policy "Users can update their own journal"
on public.journal_states for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy "Users can delete their own journal"
on public.journal_states for delete
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "Users can read their own profile" on public.profiles;
drop policy if exists "Users can update their own profile" on public.profiles;

create policy "Users can read their own profile"
on public.profiles for select
to authenticated
using ((select auth.uid()) = user_id);

create policy "Users can update their own profile"
on public.profiles for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

revoke all on public.journal_states from anon;
revoke all on public.profiles from anon;
grant select, insert, update, delete on public.journal_states to authenticated;
grant select, update on public.profiles to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'trade-charts',
  'trade-charts',
  false,
  8388608,
  array['image/png', 'image/jpeg', 'image/webp']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Users can view their own trade charts" on storage.objects;
drop policy if exists "Users can upload their own trade charts" on storage.objects;
drop policy if exists "Users can update their own trade charts" on storage.objects;
drop policy if exists "Users can delete their own trade charts" on storage.objects;

create policy "Users can view their own trade charts"
on storage.objects for select
to authenticated
using (
  bucket_id = 'trade-charts'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

create policy "Users can upload their own trade charts"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'trade-charts'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

create policy "Users can update their own trade charts"
on storage.objects for update
to authenticated
using (
  bucket_id = 'trade-charts'
  and (storage.foldername(name))[1] = (select auth.uid())::text
)
with check (
  bucket_id = 'trade-charts'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

create policy "Users can delete their own trade charts"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'trade-charts'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

notify pgrst, 'reload schema';

commit;