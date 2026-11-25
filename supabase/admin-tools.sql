-- Sylve admin tools: overview numbers, tournament verification, announcement banner.
-- Run once in the Supabase SQL editor, after feedback.sql (it uses the feedback_admins owner list).

create or replace function public.is_sylve_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.feedback_admins a where a.user_id = auth.uid());
$$;

-- Overview numbers (owner only)
create or replace function public.admin_overview()
returns json
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_sylve_admin() then raise exception 'Not allowed'; end if;
  return json_build_object(
    'tournaments', (select count(*) from public.tournaments),
    'matches', (select count(*) from public.matches),
    'completed_matches', (select count(*) from public.matches where status = 'completed'),
    'organizers', (select count(distinct created_by) from public.tournaments where created_by is not null),
    'pending_verification', (select count(*) from public.tournaments where verification_status = 'pending'),
    'feedback_total', (select count(*) from public.feedback),
    'feedback_new', (select count(*) from public.feedback where status = 'new'),
    'by_sport', (select coalesce(json_agg(json_build_object('sport', sport, 'count', c) order by c desc), '[]'::json)
                 from (select sport, count(*) c from public.tournaments group by sport) s)
  );
end;
$$;

-- Every tournament with its organizer's email (owner only)
create or replace function public.admin_list_tournaments()
returns table (
  id uuid, name text, sport text, level text, organizer_type text,
  verification_status text, start_date date, created_at timestamptz, owner_email text
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_sylve_admin() then raise exception 'Not allowed'; end if;
  return query
    select t.id, t.name, t.sport, t.level, t.organizer_type, t.verification_status, t.start_date, t.created_at,
           (select u.email::text from auth.users u where u.id = t.created_by)
    from public.tournaments t
    order by (t.verification_status = 'pending') desc, t.created_at desc
    limit 500;
end;
$$;

-- Set a tournament's verification status (owner only)
create or replace function public.admin_set_verification(p_tournament uuid, p_status text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_sylve_admin() then raise exception 'Not allowed'; end if;
  if p_status not in ('unverified', 'pending', 'verified', 'official') then raise exception 'Bad status'; end if;
  update public.tournaments set verification_status = p_status where id = p_tournament;
end;
$$;

-- Announcement banner: everyone can read it, only the owner can change it
create table if not exists public.site_announcement (
  id int primary key check (id = 1),
  message text not null default '',
  active boolean not null default false,
  updated_at timestamptz not null default now(),
  constraint site_announcement_len check (char_length(message) <= 280)
);
insert into public.site_announcement (id) values (1) on conflict (id) do nothing;

alter table public.site_announcement enable row level security;
drop policy if exists "announcement read" on public.site_announcement;
create policy "announcement read" on public.site_announcement for select to anon, authenticated using (true);
revoke insert, update, delete on public.site_announcement from anon, authenticated;

create or replace function public.admin_set_announcement(p_message text, p_active boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_sylve_admin() then raise exception 'Not allowed'; end if;
  update public.site_announcement
     set message = left(coalesce(p_message, ''), 280), active = p_active, updated_at = now()
   where id = 1;
end;
$$;

-- Only signed-in users may call the owner functions (each one still checks you are the owner).
revoke execute on function public.is_sylve_admin() from public, anon;
revoke execute on function public.admin_overview() from public, anon;
revoke execute on function public.admin_list_tournaments() from public, anon;
revoke execute on function public.admin_set_verification(uuid, text) from public, anon;
revoke execute on function public.admin_set_announcement(text, boolean) from public, anon;
grant execute on function public.is_sylve_admin() to authenticated;
grant execute on function public.admin_overview() to authenticated;
grant execute on function public.admin_list_tournaments() to authenticated;
grant execute on function public.admin_set_verification(uuid, text) to authenticated;
grant execute on function public.admin_set_announcement(text, boolean) to authenticated;
