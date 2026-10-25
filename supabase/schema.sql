-- STIKK AN-NUR 2 centralized attendance schema
-- Run this in Supabase SQL Editor. Do not put service-role keys in browser code.
create extension if not exists pgcrypto;

create table if not exists public.students (
  id text primary key,
  full_name text not null,
  nim text not null default '',
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create unique index if not exists students_name_unique on public.students (lower(full_name));

create table if not exists public.student_accounts (
  student_id text primary key references public.students(id) on delete cascade,
  pin_hash text not null,
  pin_changed_at timestamptz not null default now(),
  updated_by uuid,
  updated_at timestamptz not null default now()
);

create table if not exists public.attendance_sessions (
  id text primary key default gen_random_uuid()::text,
  course text not null,
  session_date date not null,
  meeting integer not null default 1 check (meeting > 0),
  lecturer text not null default '',
  created_by uuid,
  created_at timestamptz not null default now()
);

create table if not exists public.attendance_records (
  id uuid primary key default gen_random_uuid(),
  session_id text not null references public.attendance_sessions(id) on delete cascade,
  student_id text not null references public.students(id) on delete cascade,
  status text not null check (status in ('present','absent','permission','sick','pending')),
  updated_at timestamptz not null default now(),
  unique(session_id, student_id)
);

create table if not exists public.admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.student_login_attempts (
  id bigint generated always as identity primary key,
  student_id text,
  ip_fingerprint text not null,
  succeeded boolean not null default false,
  attempted_at timestamptz not null default now()
);
create index if not exists student_login_attempts_lookup on public.student_login_attempts(student_id, ip_fingerprint, attempted_at desc);

create table if not exists public.student_sessions (
  token_hash text primary key,
  student_id text not null references public.students(id) on delete cascade,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);
create index if not exists student_sessions_expiry on public.student_sessions(expires_at);

alter table public.students enable row level security;
alter table public.student_accounts enable row level security;
alter table public.attendance_sessions enable row level security;
alter table public.attendance_records enable row level security;
alter table public.admin_users enable row level security;
alter table public.student_login_attempts enable row level security;
alter table public.student_sessions enable row level security;

-- All access to these tables is mediated by the Edge Function using the service-role key.
-- No browser-facing anon policies are intentionally created.
revoke all on public.students, public.student_accounts, public.attendance_sessions,
  public.attendance_records, public.admin_users, public.student_login_attempts,
  public.student_sessions from anon, authenticated;

insert into public.students (id, full_name, nim) values
('student-001','Haidir Ali',''),
('student-002','Achmad Amrizal Rafsanjani',''),
('student-003','Miftahul Huda',''),
('student-004','Dhaka Sawung Mawlana',''),
('student-005','Syaif Ali Zaki',''),
('student-006','Rizky Pratama',''),
('student-007','Arga Dian Cahyo',''),
('student-008','Zaweidh Zubair',''),
('student-009','Erick Backtiar Santoso Putra',''),
('student-010','Nabila Adinda Rahma Dhani',''),
('student-011','Alun Mayang Cendany',''),
('student-012','Ajnihatul Fauziah',''),
('student-013','Nanda Arum Tribudiarti',''),
('student-014','Risyel Adelia Devi F.',''),
('student-015','Nurul Hafidzotul Amalia',''),
('student-016','Fatkhul Haris',''),
('student-017','Abdullah Syaiful Huda',''),
('student-018','Anita Eka Yulianti',''),
('student-019','Achmad Rizky Ramadhani',''),
('student-020','Seger Lancar Jaya',''),
('student-021','Muhammad Hikam','')
on conflict (id) do update set full_name=excluded.full_name;

create or replace function public.cleanup_student_security_data()
returns void language sql security definer set search_path = public as $$
  delete from public.student_login_attempts where attempted_at < now() - interval '7 days';
  delete from public.student_sessions where expires_at < now();
$$;
