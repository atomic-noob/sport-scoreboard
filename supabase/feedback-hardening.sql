-- Sylve feedback: extra security. Safe to run more than once, after feedback.sql.

-- 1. Nobody can write to the owner list from the website. Only you, in the SQL editor.
revoke insert, update, delete on public.feedback_admins from anon, authenticated;

-- 2. Visitors can only add brand-new feedback. They cannot pick a status, read, edit or delete anything.
revoke select, update, delete on public.feedback from anon;
revoke delete on public.feedback from authenticated;
revoke all on public.feedback_admins from anon;

drop policy if exists "feedback insert" on public.feedback;
create policy "feedback insert" on public.feedback
  for insert to anon, authenticated
  with check (
    status = 'new'
    and (user_id is null or user_id = auth.uid())
  );

-- 3. Admins can only change the status of a row, never the message or who sent it.
revoke update on public.feedback from authenticated;
grant update (status) on public.feedback to authenticated;

-- 4. Flood guard: refuse new feedback when more than 30 arrived in the last minute.
create or replace function public.feedback_flood_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (select count(*) from public.feedback where created_at > now() - interval '1 minute') >= 30 then
    raise exception 'Too much feedback right now. Please try again in a minute.';
  end if;
  return new;
end;
$$;

drop trigger if exists feedback_flood_guard on public.feedback;
create trigger feedback_flood_guard
  before insert on public.feedback
  for each row execute function public.feedback_flood_guard();
