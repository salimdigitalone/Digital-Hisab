-- Digital Hisab — Supabase schema
-- একবার Supabase Dashboard → SQL Editor → New query তে গিয়ে এই পুরো ফাইলটা
-- Paste করে "Run" চাপুন। এটি টেবিল, ইনডেক্স এবং Row Level Security (RLS)
-- পলিসি তৈরি করবে যাতে প্রতিটি ইউজার শুধু নিজের ডেটাই দেখতে/বদলাতে পারে।

create extension if not exists pgcrypto;

create table if not exists categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null check (type in ('Income','Expense')),
  main_category text not null,
  sub_category text not null default 'General',
  child_category text not null default 'General',
  status text not null default 'Active',
  created_at timestamptz not null default now()
);

create table if not exists transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  date date not null,
  type text not null check (type in ('Income','Expense')),
  main_category text not null,
  sub_category text not null default 'General',
  child_category text not null default 'General',
  description text default '',
  amount numeric(12,2) not null check (amount > 0),
  payment_method text not null default 'Cash',
  created_at timestamptz not null default now()
);

create index if not exists idx_categories_user on categories(user_id);
create index if not exists idx_transactions_user on transactions(user_id);
create index if not exists idx_transactions_date on transactions(date);

-- Row Level Security: প্রতিটি ইউজার শুধু নিজের রো-ই পড়তে/লিখতে/মুছতে পারবে
alter table categories enable row level security;
alter table transactions enable row level security;

create policy "Users manage their own categories"
  on categories for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users manage their own transactions"
  on transactions for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
