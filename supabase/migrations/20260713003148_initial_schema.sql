-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- Create ENUM types
create type role_type as enum ('admin', 'pimpinan');
create type status_type as enum ('aktif', 'nonaktif');
create type grade_level_type as enum ('SD', 'SMP');
create type audit_action_type as enum ('INSERT', 'UPDATE', 'DELETE');

-- 1. profiles table
create table public.profiles (
  id uuid references auth.users(id) primary key,
  full_name text,
  role role_type not null default 'admin',
  status status_type not null default 'aktif'
);

-- 2. students table
create table public.students (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  grade_level grade_level_type not null,
  class_name text not null,
  status text not null default 'aktif',
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 3. spp_payments table
create table public.spp_payments (
  id uuid primary key default gen_random_uuid(),
  student_id uuid references public.students(id) not null,
  month text not null,
  year text not null,
  spp_amount numeric not null default 0,
  uskul_amount numeric not null default 0,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  created_by uuid references public.profiles(id) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 4. psb_payments table
create table public.psb_payments (
  id uuid primary key default gen_random_uuid(),
  student_id uuid references public.students(id) not null,
  amount numeric not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  created_by uuid references public.profiles(id) not null
);

-- 5. akhir_sekolah_payments table
create table public.akhir_sekolah_payments (
  id uuid primary key default gen_random_uuid(),
  student_id uuid references public.students(id) not null,
  adm_akhir_tka numeric not null default 0,
  uang_perpisahan numeric not null default 0,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  created_by uuid references public.profiles(id) not null
);

-- 6. uniform_items table
create table public.uniform_items (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  grade_level grade_level_type not null,
  stock_quantity int not null default 0,
  unit_price numeric not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 7. uniform_sales table
create table public.uniform_sales (
  id uuid primary key default gen_random_uuid(),
  item_id uuid references public.uniform_items(id) not null,
  date date not null default CURRENT_DATE,
  quantity int not null,
  total_price numeric not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  created_by uuid references public.profiles(id) not null
);

-- 8. audit_logs table
create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  action audit_action_type not null,
  table_name text not null,
  record_id uuid not null,
  old_data jsonb,
  new_data jsonb,
  user_id uuid,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 9. config table
create table public.config (
  key text primary key,
  value jsonb not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Function for audit trigger
create or replace function public.process_audit_log()
returns trigger as $$
declare
  user_id_val uuid;
begin
  user_id_val := auth.uid();
  
  if (TG_OP = 'DELETE') then
    insert into public.audit_logs (action, table_name, record_id, old_data, user_id)
    values ('DELETE', TG_TABLE_NAME, old.id, row_to_json(old)::jsonb, user_id_val);
    return old;
  elsif (TG_OP = 'UPDATE') then
    insert into public.audit_logs (action, table_name, record_id, old_data, new_data, user_id)
    values ('UPDATE', TG_TABLE_NAME, new.id, row_to_json(old)::jsonb, row_to_json(new)::jsonb, user_id_val);
    return new;
  elsif (TG_OP = 'INSERT') then
    insert into public.audit_logs (action, table_name, record_id, new_data, user_id)
    values ('INSERT', TG_TABLE_NAME, new.id, row_to_json(new)::jsonb, user_id_val);
    return new;
  end if;
  return null;
end;
$$ language plpgsql security definer;

-- Triggers for audit logs
create trigger spp_payments_audit_trigger after insert or update or delete on public.spp_payments for each row execute function public.process_audit_log();
create trigger psb_payments_audit_trigger after insert or update or delete on public.psb_payments for each row execute function public.process_audit_log();
create trigger akhir_sekolah_payments_audit_trigger after insert or update or delete on public.akhir_sekolah_payments for each row execute function public.process_audit_log();
create trigger uniform_sales_audit_trigger after insert or update or delete on public.uniform_sales for each row execute function public.process_audit_log();
create trigger uniform_items_audit_trigger after insert or update or delete on public.uniform_items for each row execute function public.process_audit_log();
create trigger students_audit_trigger after insert or update or delete on public.students for each row execute function public.process_audit_log();

-- RLS
alter table public.profiles enable row level security;
alter table public.students enable row level security;
alter table public.spp_payments enable row level security;
alter table public.psb_payments enable row level security;
alter table public.akhir_sekolah_payments enable row level security;
alter table public.uniform_items enable row level security;
alter table public.uniform_sales enable row level security;
alter table public.audit_logs enable row level security;
alter table public.config enable row level security;

-- Policies (simple setup for admin access)
create policy "Allow authenticated read" on public.profiles for select using (auth.role() = 'authenticated');
create policy "Allow authenticated read" on public.students for select using (auth.role() = 'authenticated');
create policy "Allow authenticated read" on public.spp_payments for select using (auth.role() = 'authenticated');
create policy "Allow authenticated read" on public.psb_payments for select using (auth.role() = 'authenticated');
create policy "Allow authenticated read" on public.akhir_sekolah_payments for select using (auth.role() = 'authenticated');
create policy "Allow authenticated read" on public.uniform_items for select using (auth.role() = 'authenticated');
create policy "Allow authenticated read" on public.uniform_sales for select using (auth.role() = 'authenticated');
create policy "Allow authenticated read" on public.audit_logs for select using (auth.role() = 'authenticated');
create policy "Allow authenticated read" on public.config for select using (auth.role() = 'authenticated');

create policy "Allow authenticated insert" on public.students for insert with check (auth.role() = 'authenticated');
create policy "Allow authenticated update" on public.students for update using (auth.role() = 'authenticated');
create policy "Allow authenticated insert" on public.spp_payments for insert with check (auth.role() = 'authenticated');
create policy "Allow authenticated update" on public.spp_payments for update using (auth.role() = 'authenticated');
create policy "Allow authenticated insert" on public.psb_payments for insert with check (auth.role() = 'authenticated');
create policy "Allow authenticated update" on public.psb_payments for update using (auth.role() = 'authenticated');
create policy "Allow authenticated insert" on public.akhir_sekolah_payments for insert with check (auth.role() = 'authenticated');
create policy "Allow authenticated update" on public.akhir_sekolah_payments for update using (auth.role() = 'authenticated');
create policy "Allow authenticated insert" on public.uniform_items for insert with check (auth.role() = 'authenticated');
create policy "Allow authenticated update" on public.uniform_items for update using (auth.role() = 'authenticated');
create policy "Allow authenticated insert" on public.uniform_sales for insert with check (auth.role() = 'authenticated');
create policy "Allow authenticated update" on public.uniform_sales for update using (auth.role() = 'authenticated');
create policy "Allow authenticated insert" on public.config for insert with check (auth.role() = 'authenticated');
create policy "Allow authenticated update" on public.config for update using (auth.role() = 'authenticated');
