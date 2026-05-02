begin;

create or replace function public.transfer_funds(
  p_from_store_id uuid,
  p_to_store_id uuid,
  p_amount numeric,
  p_description text
)
returns void
language plpgsql
security definer
as $function$
begin
  insert into public.transactions (store_id, type, amount, category, notes, user_id)
  values (p_from_store_id, 'expense', p_amount, 'Μεταφορά Κεφαλαίου', 'Προς: ' || p_description, auth.uid());

  insert into public.transactions (store_id, type, amount, category, notes, user_id)
  values (p_to_store_id, 'income', p_amount, 'Μεταφορά Κεφαλαίου', 'Από: ' || p_description, auth.uid());
end;
$function$;

grant execute on function public.transfer_funds(uuid, uuid, numeric, text) to authenticated;

commit;
