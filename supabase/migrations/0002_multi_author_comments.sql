alter table public.books
  add column if not exists comments_enabled boolean not null default true;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null check (char_length(display_name) between 1 and 80),
  avatar_initial text not null check (char_length(avatar_initial) between 1 and 2),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.handle_new_user_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  name text;
begin
  name := coalesce(nullif(new.raw_user_meta_data->>'display_name', ''), split_part(coalesce(new.email, '读者'), '@', 1), '读者');
  insert into public.profiles (id, display_name, avatar_initial)
  values (new.id, left(name, 80), left(name, 1))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created_profile on auth.users;
create trigger on_auth_user_created_profile
  after insert on auth.users
  for each row execute procedure public.handle_new_user_profile();

insert into public.profiles (id, display_name, avatar_initial)
select
  id,
  left(coalesce(nullif(raw_user_meta_data->>'display_name', ''), split_part(coalesce(email, '读者'), '@', 1), '读者'), 80),
  left(coalesce(nullif(raw_user_meta_data->>'display_name', ''), split_part(coalesce(email, '读者'), '@', 1), '读者'), 1)
from auth.users
on conflict (id) do nothing;

-- Comments bind to both the book and an immutable version.
alter table public.book_versions
  add constraint book_versions_book_id_id_unique unique (book_id, id);

create table public.book_comments (
  id uuid primary key default gen_random_uuid(),
  book_id uuid not null references public.books(id) on delete cascade,
  version_id uuid not null references public.book_versions(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check (char_length(btrim(body)) between 1 and 500),
  page_number integer check (page_number is null or page_number > 0),
  status text not null default 'visible' check (status in ('visible', 'hidden')),
  created_at timestamptz not null default now(),
  constraint comment_version_belongs_to_book foreign key (book_id, version_id)
    references public.book_versions (book_id, id) on delete cascade
);

create index book_comments_public_version on public.book_comments (book_id, version_id, created_at)
  where status = 'visible';
create index book_comments_user on public.book_comments (user_id, created_at desc);

alter table public.profiles enable row level security;
alter table public.book_comments enable row level security;

create policy "public profiles are readable" on public.profiles
  for select using (true);
create policy "users update their profile" on public.profiles
  for update using (id = auth.uid()) with check (id = auth.uid());

create policy "read comments on current published version" on public.book_comments
  for select using (
    status = 'visible'
    and exists (
      select 1 from public.books
      where books.id = book_comments.book_id
        and books.current_version_id = book_comments.version_id
        and books.visibility in ('public', 'unlisted')
    )
  );

create policy "logged in users comment on current version" on public.book_comments
  for insert with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.books
      where books.id = book_comments.book_id
        and books.current_version_id = book_comments.version_id
        and books.visibility in ('public', 'unlisted')
        and books.comments_enabled = true
    )
  );

create policy "commenters or authors delete comments" on public.book_comments
  for delete using (
    user_id = auth.uid()
    or exists (
      select 1 from public.books
      where books.id = book_comments.book_id and books.author_id = auth.uid()
    )
  );

create policy "authors moderate comments" on public.book_comments
  for update using (
    exists (
      select 1 from public.books
      where books.id = book_comments.book_id and books.author_id = auth.uid()
    )
  ) with check (
    exists (
      select 1 from public.books
      where books.id = book_comments.book_id and books.author_id = auth.uid()
    )
  );

-- Existing book policies already require author_id = auth.uid() for every insert,
-- update, and delete. Public users only receive SELECT access to published metadata.
