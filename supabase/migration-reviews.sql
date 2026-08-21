-- ============================================================
-- Casebook Timeline - 增量迁移：公开书评系统
-- 在 Supabase SQL Editor 中执行一次即可（脚本幂等，可安全重跑）。
-- 不删除、不修改任何现有表与数据。
-- ============================================================

-- ---------- 评论者昵称档案 ----------
-- auth.users 对 anon key 不可读，公开书评需要展示昵称，
-- 因此增加最小 profiles 表；新用户由触发器自动建档。

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default '匿名侦探',
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

drop policy if exists "profiles are publicly readable" on public.profiles;
create policy "profiles are publicly readable"
  on public.profiles for select
  using (true);

-- 为已注册用户补建档案（幂等）
insert into public.profiles (id, display_name)
select u.id, '读者-' || substr(u.id::text, 1, 8)
from auth.users u
on conflict (id) do nothing;

-- 新用户注册时自动建档
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, '读者-' || substr(new.id::text, 1, 8));
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------- 公开书评 ----------
-- 公开可读；登录后可写；只能改/删自己的评论。
-- user_id 指向 profiles（其 id 即 auth.users.id），
-- 以便 PostgREST 直接嵌入 profiles(display_name)。

create table if not exists public.reviews (
  id uuid primary key default gen_random_uuid(),
  book_id text not null references public.books(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  content text not null check (char_length(btrim(content)) between 1 and 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_reviews_book_created
  on public.reviews (book_id, created_at desc);

create index if not exists idx_reviews_user
  on public.reviews (user_id, created_at desc);

alter table public.reviews enable row level security;

-- 所有人（含未登录）可读
drop policy if exists "reviews are publicly readable" on public.reviews;
create policy "reviews are publicly readable"
  on public.reviews for select
  using (true);

-- 仅登录用户可发表，且身份由数据库保证（不信任前端传参）
drop policy if exists "authenticated users can insert own reviews" on public.reviews;
create policy "authenticated users can insert own reviews"
  on public.reviews for insert to authenticated
  with check (auth.uid() = user_id);

-- 只能修改自己的评论
drop policy if exists "users can update own reviews" on public.reviews;
create policy "users can update own reviews"
  on public.reviews for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- 只能删除自己的评论
drop policy if exists "users can delete own reviews" on public.reviews;
create policy "users can delete own reviews"
  on public.reviews for delete to authenticated
  using (auth.uid() = user_id);
