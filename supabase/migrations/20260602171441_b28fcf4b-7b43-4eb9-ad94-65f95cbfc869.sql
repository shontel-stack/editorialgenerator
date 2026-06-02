create table public.issue_chats (
  id uuid primary key default gen_random_uuid(),
  issue_id text not null,
  role text not null check (role in ('user','assistant','system')),
  parts jsonb not null,
  created_at timestamptz not null default now()
);

create index issue_chats_issue_id_created_at_idx
  on public.issue_chats (issue_id, created_at);

grant select, insert, delete on public.issue_chats to anon, authenticated;
grant all on public.issue_chats to service_role;

alter table public.issue_chats enable row level security;

create policy "anyone can read issue chats"
  on public.issue_chats for select
  to anon, authenticated
  using (true);

create policy "anyone can insert issue chats"
  on public.issue_chats for insert
  to anon, authenticated
  with check (true);

create policy "anyone can delete issue chats"
  on public.issue_chats for delete
  to anon, authenticated
  using (true);