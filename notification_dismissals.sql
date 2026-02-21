create table if not exists public.notification_dismissals (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null,
  user_id uuid not null,
  notification_key text not null,
  dismissed_at timestamptz not null default now()
);

create unique index if not exists notification_dismissals_unique
on public.notification_dismissals (store_id, user_id, notification_key);

alter table public.notification_dismissals enable row level security;

drop policy if exists "dismissals_select_own" on public.notification_dismissals;
create policy "dismissals_select_own"
on public.notification_dismissals
for select
using (auth.uid() = user_id);

drop policy if exists "dismissals_insert_own" on public.notification_dismissals;
create policy "dismissals_insert_own"
on public.notification_dismissals
for insert
with check (auth.uid() = user_id);

drop policy if exists "dismissals_delete_own" on public.notification_dismissals;
create policy "dismissals_delete_own"
on public.notification_dismissals
for delete
using (auth.uid() = user_id);
