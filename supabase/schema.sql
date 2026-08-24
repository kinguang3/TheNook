-- ============================================================
-- Casebook Timeline - Supabase schema
-- Run this in the Supabase SQL Editor.
-- ============================================================

-- ---------- 目录数据（公开可读） ----------

create table if not exists public.authors (
  id text primary key,
  name text not null,
  summary text not null default ''
);

create table if not exists public.series (
  id text primary key,
  name text not null,
  summary text not null default ''
);

create table if not exists public.books (
  id text primary key,
  title text not null,
  author_id text not null references public.authors(id),
  series_id text references public.series(id),
  year integer not null,
  read_time text not null,
  cover_tone text not null default 'cover-slate',
  cover_mark text not null default '',
  cover_url text not null default '',
  rating integer not null default 5,
  tags text[] not null default '{}',
  blurb text not null default '',
  note text not null default ''
);

-- ---------- 用户数据（仅本人可读写） ----------

create table if not exists public.favorites (
  user_id uuid not null references auth.users(id) on delete cascade,
  book_id text not null references public.books(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, book_id)
);

create table if not exists public.ratings (
  user_id uuid not null references auth.users(id) on delete cascade,
  book_id text not null references public.books(id) on delete cascade,
  value integer not null check (value between 1 and 5),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, book_id)
);

-- 推荐算法按书目聚合评分时走此索引
create index if not exists idx_ratings_book
  on public.ratings (book_id);

create table if not exists public.notes (
  user_id uuid not null references auth.users(id) on delete cascade,
  book_id text not null references public.books(id) on delete cascade,
  content text not null default '',
  updated_at timestamptz not null default now(),
  primary key (user_id, book_id)
);

create table if not exists public.shelf (
  user_id uuid not null references auth.users(id) on delete cascade,
  book_id text not null references public.books(id) on delete cascade,
  progress integer not null default 0 check (progress between 0 and 100),
  status text not null default 'unread'
    check (status in ('unread', 'reading', 'finished')),
  last_read_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key (user_id, book_id)
);

-- 评论者昵称档案（auth.users 对 anon key 不可读，公开书评需要展示昵称）
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default '匿名侦探',
  created_at timestamptz not null default now()
);

-- 公开书评：公开可读、登录可写、仅本人可改删
create table if not exists public.reviews (
  id uuid primary key default gen_random_uuid(),
  book_id text not null references public.books(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  content text not null check (char_length(btrim(content)) between 1 and 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------- Row Level Security ----------

alter table public.authors enable row level security;
alter table public.series enable row level security;
alter table public.books enable row level security;
alter table public.favorites enable row level security;
alter table public.ratings enable row level security;
alter table public.notes enable row level security;
alter table public.shelf enable row level security;
alter table public.profiles enable row level security;
alter table public.reviews enable row level security;

-- 目录数据对所有人（含匿名）可读
create policy "authors are publicly readable"
  on public.authors for select
  using (true);

create policy "series are publicly readable"
  on public.series for select
  using (true);

create policy "books are publicly readable"
  on public.books for select
  using (true);

-- 用户数据：只能操作自己的行
create policy "favorites are private to owner"
  on public.favorites for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "ratings are private to owner"
  on public.ratings for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "notes are private to owner"
  on public.notes for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "shelf is private to owner"
  on public.shelf for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- 昵称档案对所有人（含匿名）可读
drop policy if exists "profiles are publicly readable" on public.profiles;
create policy "profiles are publicly readable"
  on public.profiles for select
  using (true);

-- 书评：公开可读；登录可写；仅本人可改删
drop policy if exists "reviews are publicly readable" on public.reviews;
create policy "reviews are publicly readable"
  on public.reviews for select
  using (true);

drop policy if exists "authenticated users can insert own reviews" on public.reviews;
create policy "authenticated users can insert own reviews"
  on public.reviews for insert to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "users can update own reviews" on public.reviews;
create policy "users can update own reviews"
  on public.reviews for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "users can delete own reviews" on public.reviews;
create policy "users can delete own reviews"
  on public.reviews for delete to authenticated
  using (auth.uid() = user_id);

-- ---------- 种子数据 ----------

insert into public.authors (id, name, summary) values
  ('keigo-higashino', '东野圭吾', '以冷静而高可读性的叙述著称，擅长把社会议题与精巧谜面并置，让推理既具戏剧张力，也保留情感余波。'),
  ('soji-shimada', '岛田庄司', '新本格的重要代表作者，常以宏大的不可能犯罪与浓烈叙事氛围推动故事，谜题密度和舞台感都极强。'),
  ('seicho-matsumoto', '松本清张', '社会派推理的奠基作者之一，以冷峻视角审视制度、阶层与人性，让案件背后总带着现实的寒意。'),
  ('agatha-christie', '阿加莎·克里斯蒂', '古典推理标杆人物，节奏清晰、结构稳定，善于用精确铺陈和叙述诡计制造最后一击。'),
  ('ellery-queen', '埃勒里·奎因', '硬核逻辑推理的重要名字，迷恋线索公平性与演绎快感，适合喜欢一步步参与破案的读者。')
on conflict (id) do nothing;

insert into public.series (id, name, summary) values
  ('galileo-series', '伽利略系列', '以汤川学为核心的系列作品，将科学解释与案件谜团组合在一起，兼具可读性、人物魅力和跨题材趣味。'),
  ('kaga-series', '加贺探案系列', '以加贺恭一郎为中心的调查线，重视人物关系与社会环境，案件解决往往伴随着情感剖面。'),
  ('mitarai-series', '御手洗洁系列', '充满不可能犯罪、诡谲舞台与新本格美学的系列读物，适合偏爱奇观谜面的读者。'),
  ('poirot-series', '波洛系列', '古典侦探范式的代表，强调推理秩序、人物动机和结尾的戏剧性揭示。')
on conflict (id) do nothing;

insert into public.books (id, title, author_id, series_id, year, read_time, cover_tone, cover_mark, cover_url, rating, tags, blurb, note) values
  ('journey-under-the-midnight-sun', '白夜行', 'keigo-higashino', null, 1999, '2026.01', 'cover-slate', '01', 'https://exixzgnhsyjnsrgzhrct.supabase.co/storage/v1/object/public/covers/journey-under-the-midnight-sun.jpg', 5, '{社会派,日系,心理悬疑}', '长达数十年的命运纠缠让案件本身逐渐退到幕后，真正令人发冷的是两位主角彼此缝合的人生结构。', '更像一部冷色调的人物史。推理不是唯一重点，但压抑感和命运感极强，后劲很长。'),
  ('the-devotion-of-suspect-x', '嫌疑人X的献身', 'keigo-higashino', 'galileo-series', 2005, '2026.02', 'cover-ember', '02', 'https://exixzgnhsyjnsrgzhrct.supabase.co/storage/v1/object/public/covers/the-devotion-of-suspect-x.jpg', 5, '{社会派,日系,诡计流}', '以数学般克制的叙事处理牺牲、爱与自毁，把一个看似清楚的案件推向极度悲伤的终局。', '核心不是谜底本身，而是为了成全某人可以精密到何种程度。读完会安静很久。'),
  ('malice', '恶意', 'keigo-higashino', 'kaga-series', 1996, '2026.03', 'cover-graphite', '03', 'https://exixzgnhsyjnsrgzhrct.supabase.co/storage/v1/object/public/covers/malice.jpg', 4, '{日系,心理悬疑,叙述诡计}', '案件很早便有答案，真正的推理在于恶意为何形成、如何被伪装，以及它如何扭曲一段看似平常的关系。', '从动机层面完成反转，结构不炫技但非常扎实，适合喜欢心理层层剥开的读者。'),
  ('tokyo-zodiac-murders', '占星术杀人魔法', 'soji-shimada', 'mitarai-series', 1981, '2026.04', 'cover-violet', '04', 'https://exixzgnhsyjnsrgzhrct.supabase.co/storage/v1/object/public/covers/tokyo-zodiac-murders.jpg', 5, '{本格推理,日系,不可能犯罪}', '带有传奇感的设定与巨大的谜面相互咬合，整本书像在邀请读者正面挑战一个足够大胆的迷宫。', '新本格入门常客。谜面宏大，解答也足够爽快，适合想重新点燃推理阅读兴奋感的时候。'),
  ('points-and-lines', '点与线', 'seicho-matsumoto', null, 1958, '2026.05', 'cover-forest', '05', 'https://exixzgnhsyjnsrgzhrct.supabase.co/storage/v1/object/public/covers/points-and-lines.jpg', 4, '{社会派,日系,现实主义}', '以列车时刻表和细密调查推进案件，在冷静的程序感里慢慢逼出制度与人情共同构成的压力。', '朴素但耐读，越读越能感受到社会派的锋利来自现实细节而不是夸张诡计。'),
  ('murder-on-the-orient-express', '东方快车谋杀案', 'agatha-christie', 'poirot-series', 1934, '2026.05', 'cover-burgundy', '06', 'https://exixzgnhsyjnsrgzhrct.supabase.co/storage/v1/object/public/covers/murder-on-the-orient-express.jpg', 5, '{欧美,本格推理,经典}', '封闭环境、稳定节奏与强戏剧性收束都近乎教科书级别，是古典推理最有辨识度的样子之一。', '即使早知道名气，也还是会被最后的处理方式击中。结构完成度非常高。'),
  ('and-then-there-were-none', '无人生还', 'agatha-christie', null, 1939, '2026.06', 'cover-ocean', '07', 'https://exixzgnhsyjnsrgzhrct.supabase.co/storage/v1/object/public/covers/and-then-there-were-none.jpg', 5, '{欧美,本格推理,孤岛悬疑}', '规则清晰、压迫感持续加重，角色与童谣共同构成步步逼近的倒计时，是氛围与结构同步发力的经典。', '节奏控制极稳，悬疑张力几乎没有浪费的段落。非常适合一口气读完。'),
  ('the-greek-coffin-mystery', '希腊棺材之谜', 'ellery-queen', null, 1932, '2026.07', 'cover-steel', '08', 'https://exixzgnhsyjnsrgzhrct.supabase.co/storage/v1/object/public/covers/the-greek-coffin-mystery.jpg', 4, '{硬核推理,欧美,逻辑流}', '围绕遗嘱、尸体与身份构建层层校验的逻辑游戏，细节多、回看价值高，阅读过程非常像参与一次正式推演。', '需要专注，但公平而过瘾。适合想要扎实演绎感、愿意慢慢咀嚼线索的读者。')
on conflict (id) do nothing;

-- 为已存在的行补上封面（重跑脚本时覆盖旧值）
update public.books set cover_url = v.cover_url
from (values
  ('journey-under-the-midnight-sun', 'https://exixzgnhsyjnsrgzhrct.supabase.co/storage/v1/object/public/covers/journey-under-the-midnight-sun.jpg'),
  ('the-devotion-of-suspect-x', 'https://exixzgnhsyjnsrgzhrct.supabase.co/storage/v1/object/public/covers/the-devotion-of-suspect-x.jpg'),
  ('malice', 'https://exixzgnhsyjnsrgzhrct.supabase.co/storage/v1/object/public/covers/malice.jpg'),
  ('tokyo-zodiac-murders', 'https://exixzgnhsyjnsrgzhrct.supabase.co/storage/v1/object/public/covers/tokyo-zodiac-murders.jpg'),
  ('points-and-lines', 'https://exixzgnhsyjnsrgzhrct.supabase.co/storage/v1/object/public/covers/points-and-lines.jpg'),
  ('murder-on-the-orient-express', 'https://exixzgnhsyjnsrgzhrct.supabase.co/storage/v1/object/public/covers/murder-on-the-orient-express.jpg'),
  ('and-then-there-were-none', 'https://exixzgnhsyjnsrgzhrct.supabase.co/storage/v1/object/public/covers/and-then-there-were-none.jpg'),
  ('the-greek-coffin-mystery', 'https://exixzgnhsyjnsrgzhrct.supabase.co/storage/v1/object/public/covers/the-greek-coffin-mystery.jpg')
) as v(id, cover_url)
where public.books.id = v.id;

-- ---------- 书评辅助：新用户自动建档 + 存量用户补档 ----------

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

insert into public.profiles (id, display_name)
select u.id, '读者-' || substr(u.id::text, 1, 8)
from auth.users u
on conflict (id) do nothing;

-- ---------- ���־ۺ���ͼ���Ƽ��㷨 / �ۺ���������Դ�� ----------
-- �ײ� ratings �� RLS �����˿ɶ�������ͼ�� owner Ȩ�޾ۺ�ȫ�����ݣ�
-- ��ͨ����ͼ������ RLS ����������ȡ�ۺϽ�����������κ��û���ϸ�У���

create or replace view public.rating_stats as
select
  book_id,
  avg(value)::numeric(3, 2) as avg_value,
  count(*)::integer as rating_count
from public.ratings
group by book_id;

alter table public.rating_stats enable row level security;

drop policy if exists "rating stats are publicly readable" on public.rating_stats;
create policy "rating stats are publicly readable"
  on public.rating_stats for select
  using (true);
