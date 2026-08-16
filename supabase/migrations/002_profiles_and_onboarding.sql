create table if not exists public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  username text not null unique check (username ~ '^[A-Za-z0-9_]{3,24}$'),
  onboarding_completed boolean not null default false,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);


insert into public.profiles (user_id, full_name, username, onboarding_completed)
select
  id,
  coalesce(raw_user_meta_data ->> 'full_name', ''),
  coalesce(nullif(raw_user_meta_data ->> 'username', ''), 'trader_' || substr(id::text, 1, 8)),
  false
from auth.users
on conflict (user_id) do nothing;
alter table public.profiles enable row level security;

create policy "Users can read their own profile"
on public.profiles for select
using (auth.uid() = user_id);

create policy "Users can update their own profile"
on public.profiles for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (user_id, full_name, username)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    coalesce(new.raw_user_meta_data ->> 'username', 'trader_' || substr(new.id::text, 1, 8))
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

create trigger set_profiles_updated_at
before update on public.profiles
for each row execute function public.set_journal_updated_at();