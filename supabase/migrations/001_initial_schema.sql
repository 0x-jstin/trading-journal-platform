-- Trading Journal initial cloud schema
-- Apply with the Supabase SQL editor or Supabase CLI.

create table if not exists public.journal_states (
  user_id uuid primary key references auth.users(id) on delete cascade,
  state jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default timezone('utc', now())
);

alter table public.journal_states enable row level security;

create policy "Users can read their own journal"
on public.journal_states
for select
using (auth.uid() = user_id);

create policy "Users can create their own journal"
on public.journal_states
for insert
with check (auth.uid() = user_id);

create policy "Users can update their own journal"
on public.journal_states
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create or replace function public.set_journal_updated_at()
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

drop trigger if exists set_journal_states_updated_at on public.journal_states;
create trigger set_journal_states_updated_at
before update on public.journal_states
for each row execute function public.set_journal_updated_at();

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

create policy "Users can view their own trade charts"
on storage.objects
for select
using (
  bucket_id = 'trade-charts'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "Users can upload their own trade charts"
on storage.objects
for insert
with check (
  bucket_id = 'trade-charts'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "Users can update their own trade charts"
on storage.objects
for update
using (
  bucket_id = 'trade-charts'
  and (storage.foldername(name))[1] = auth.uid()::text
)
with check (
  bucket_id = 'trade-charts'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "Users can delete their own trade charts"
on storage.objects
for delete
using (
  bucket_id = 'trade-charts'
  and (storage.foldername(name))[1] = auth.uid()::text
);