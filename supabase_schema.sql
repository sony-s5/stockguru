-- Run this in Supabase SQL Editor

-- Stocks table
create table stocks (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  ticker text not null unique,
  sector text,
  analysis jsonb,  -- stores all 12-step data
  created_at timestamp default now(),
  updated_at timestamp default now()
);

-- Portfolios table (per user)
create table portfolios (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade,
  ticker text not null,
  stock_name text,
  buy_price numeric,
  quantity numeric,
  notes text,
  created_at timestamp default now()
);

-- RLS Policies
alter table stocks enable row level security;
alter table portfolios enable row level security;

-- Anyone can read stocks
create policy "Public read stocks" on stocks for select using (true);

-- Admins can insert/update stocks (set your user id below)
create policy "Admin write stocks" on stocks for all
  using (auth.uid() = 'YOUR_ADMIN_USER_ID');

-- Users can only see their own portfolio
create policy "User portfolio" on portfolios for all
  using (auth.uid() = user_id);
