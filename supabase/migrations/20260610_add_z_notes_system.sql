begin;

create table if not exists public.z_notes (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null,
  business_date date not null,
  note_text text not null check (length(btrim(note_text)) > 0),
  note_type text null,
  created_at timestamptz not null default now(),
  created_by uuid not null,
  updated_at timestamptz not null default now(),
  updated_by uuid null,
  is_deleted boolean not null default false,
  deleted_at timestamptz null,
  deleted_by uuid null
);

create table if not exists public.z_note_revisions (
  id uuid primary key default gen_random_uuid(),
  note_id uuid not null references public.z_notes(id) on delete cascade,
  action text not null check (action in ('insert', 'update', 'delete')),
  old_text text null,
  new_text text null,
  changed_at timestamptz not null default now(),
  changed_by uuid not null
);

create index if not exists idx_z_notes_store_date_created
  on public.z_notes (store_id, business_date, created_at desc)
  where is_deleted = false;

create index if not exists idx_z_notes_store_date_updated
  on public.z_notes (store_id, business_date, updated_at desc)
  where is_deleted = false;

create index if not exists idx_z_notes_store_date_type
  on public.z_notes (store_id, business_date, note_type)
  where is_deleted = false;

create index if not exists idx_z_note_revisions_note_changed
  on public.z_note_revisions (note_id, changed_at desc);

alter table public.z_notes enable row level security;
alter table public.z_note_revisions enable row level security;

revoke all on table public.z_notes from public;
revoke all on table public.z_note_revisions from public;

grant select, insert, update on table public.z_notes to authenticated;
grant select on table public.z_note_revisions to authenticated;

drop policy if exists z_notes_select_store_member on public.z_notes;
create policy z_notes_select_store_member
on public.z_notes
for select
to authenticated
using (
  exists (
    select 1
    from public.store_access sa
    where sa.user_id = auth.uid()
      and sa.store_id = z_notes.store_id
  )
);

drop policy if exists z_notes_insert_editor on public.z_notes;
create policy z_notes_insert_editor
on public.z_notes
for insert
to authenticated
with check (
  exists (
    select 1
    from public.store_access sa
    where sa.user_id = auth.uid()
      and sa.store_id = z_notes.store_id
      and (sa.role = 'admin' or coalesce(sa.can_edit_transactions, false) = true)
  )
  and auth.uid() is not null
  and created_by = auth.uid()
);

drop policy if exists z_notes_update_editor on public.z_notes;
create policy z_notes_update_editor
on public.z_notes
for update
to authenticated
using (
  exists (
    select 1
    from public.store_access sa
    where sa.user_id = auth.uid()
      and sa.store_id = z_notes.store_id
      and (sa.role = 'admin' or coalesce(sa.can_edit_transactions, false) = true)
  )
)
with check (
  exists (
    select 1
    from public.store_access sa
    where sa.user_id = auth.uid()
      and sa.store_id = z_notes.store_id
      and (sa.role = 'admin' or coalesce(sa.can_edit_transactions, false) = true)
  )
);

create or replace function public.trg_z_notes_set_updated_fields()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  new.updated_at := now();
  new.updated_by := coalesce(new.updated_by, auth.uid(), old.updated_by);

  if new.is_deleted is true and old.is_deleted is false then
    new.deleted_at := coalesce(new.deleted_at, now());
    new.deleted_by := coalesce(new.deleted_by, auth.uid(), new.updated_by);
  elsif new.is_deleted is false then
    new.deleted_at := null;
    new.deleted_by := null;
  end if;

  return new;
end;
$$;

create or replace function public.trg_z_notes_write_revision()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_changed_by uuid;
begin
  v_changed_by := coalesce(auth.uid(), new.updated_by, new.created_by, old.updated_by, old.created_by);

  if tg_op = 'INSERT' then
    insert into public.z_note_revisions (note_id, action, old_text, new_text, changed_at, changed_by)
    values (new.id, 'insert', null, new.note_text, now(), v_changed_by);
    return new;
  end if;

  if tg_op = 'UPDATE' then
    if old.is_deleted = false and new.is_deleted = true then
      insert into public.z_note_revisions (note_id, action, old_text, new_text, changed_at, changed_by)
      values (new.id, 'delete', old.note_text, null, now(), v_changed_by);
    elsif coalesce(old.note_text, '') is distinct from coalesce(new.note_text, '') then
      insert into public.z_note_revisions (note_id, action, old_text, new_text, changed_at, changed_by)
      values (new.id, 'update', old.note_text, new.note_text, now(), v_changed_by);
    end if;

    return new;
  end if;

  return coalesce(new, old);
end;
$$;

drop trigger if exists trg_z_notes_set_updated_fields on public.z_notes;
create trigger trg_z_notes_set_updated_fields
before update on public.z_notes
for each row
execute function public.trg_z_notes_set_updated_fields();

drop trigger if exists trg_z_notes_write_revision on public.z_notes;
create trigger trg_z_notes_write_revision
after insert or update on public.z_notes
for each row
execute function public.trg_z_notes_write_revision();

drop policy if exists z_note_revisions_select_history on public.z_note_revisions;
do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'store_access'
      and column_name = 'can_view_history'
  ) then
    execute $policy$
      create policy z_note_revisions_select_history
      on public.z_note_revisions
      for select
      to authenticated
      using (
        exists (
          select 1
          from public.z_notes zn
          join public.store_access sa
            on sa.store_id = zn.store_id
          where zn.id = z_note_revisions.note_id
            and sa.user_id = auth.uid()
            and (sa.role = 'admin' or coalesce(sa.can_view_history, false) = true)
        )
      )
    $policy$;
  else
    execute $policy$
      create policy z_note_revisions_select_history
      on public.z_note_revisions
      for select
      to authenticated
      using (
        exists (
          select 1
          from public.z_notes zn
          join public.store_access sa
            on sa.store_id = zn.store_id
          where zn.id = z_note_revisions.note_id
            and sa.user_id = auth.uid()
            and sa.role = 'admin'
        )
      )
    $policy$;
  end if;
end
$$;

commit;
