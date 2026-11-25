-- Sylve feedback. Run once in the Supabase SQL editor.

create table if not exists public.feedback (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  user_id uuid references auth.users(id) on delete set null,
  contact text,                       -- optional email or Facebook name the tester typed
  kind text not null default 'idea',  -- bug | idea | praise | other
  message text not null,
  page text,                          -- address the tester was on
  user_agent text,
  status text not null default 'new', -- new | read | done
  constraint feedback_kind_ok check (kind in ('bug', 'idea', 'praise', 'other')),
  constraint feedback_message_len check (char_length(message) between 3 and 2000),
  constraint feedback_contact_len check (contact is null or char_length(contact) <= 200)
);

-- Who may read the inbox. Add yourself once (see the last lines of this file).
create table if not exists public.feedback_admins (
  user_id uuid primary key references auth.users(id) on delete cascade
);

alter table public.feedback enable row level security;
alter table public.feedback_admins enable row level security;

-- Anyone (signed in or not) can send feedback. If signed in, user_id must be their own id.
drop policy if exists "feedback insert" on public.feedback;
create policy "feedback insert" on public.feedback
  for insert to anon, authenticated
  with check (user_id is null or user_id = auth.uid());

-- Only admins can read and update (mark read / done).
drop policy if exists "feedback admin read" on public.feedback;
create policy "feedback admin read" on public.feedback
  for select to authenticated
  using (exists (select 1 from public.feedback_admins a where a.user_id = auth.uid()));

drop policy if exists "feedback admin update" on public.feedback;
create policy "feedback admin update" on public.feedback
  for update to authenticated
  using (exists (select 1 from public.feedback_admins a where a.user_id = auth.uid()))
  with check (exists (select 1 from public.feedback_admins a where a.user_id = auth.uid()));

-- A signed-in user can see whether they themselves are an admin (used to show the inbox link).
drop policy if exists "admins see self" on public.feedback_admins;
create policy "admins see self" on public.feedback_admins
  for select to authenticated using (user_id = auth.uid());

-- Make yourself an admin: replace the email with the one you sign in to Sylve with, then run.
-- insert into public.feedback_admins (user_id)
-- select id from auth.users where email = 'YOUR-SIGN-IN-EMAIL';
