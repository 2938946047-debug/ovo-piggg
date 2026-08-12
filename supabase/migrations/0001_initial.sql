create extension if not exists vector with schema extensions;
create extension if not exists pgcrypto with schema extensions;

create type public.book_visibility as enum ('draft', 'unlisted', 'public');
create type public.context_visibility as enum ('draft', 'published');

create or replace function public.scene_document_is_white(document jsonb)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select document->>'backgroundPolicy' = 'fixed-white'
    and document->>'version' = '1'
    and jsonb_typeof(document->'pages') = 'array'
    and not exists (
      select 1
      from jsonb_array_elements(document->'pages') as page
      where page->>'background' is distinct from '#ffffff'
    );
$$;

create table public.books (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references auth.users(id) on delete cascade,
  slug text not null unique,
  title text not null default '未命名摄影书',
  subtitle text not null default '',
  description text not null default '',
  visibility public.book_visibility not null default 'draft',
  ai_enabled boolean not null default true,
  draft_document jsonb not null,
  current_version_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint books_white_draft check (public.scene_document_is_white(draft_document))
);

create table public.book_versions (
  id uuid primary key default gen_random_uuid(),
  book_id uuid not null references public.books(id) on delete cascade,
  version_number integer not null,
  document jsonb not null,
  published_at timestamptz not null default now(),
  unique (book_id, version_number),
  constraint versions_white_document check (public.scene_document_is_white(document))
);

alter table public.books add constraint books_current_version_fk
  foreign key (current_version_id) references public.book_versions(id) on delete set null;

create table public.book_assets (
  id uuid primary key default gen_random_uuid(),
  book_id uuid not null references public.books(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  storage_path text not null,
  public_derivative_path text,
  media_type text not null,
  width integer,
  height integer,
  city text,
  exact_location text,
  exact_location_encrypted bytea,
  gps_visibility text not null default 'hidden' check (gps_visibility in ('hidden', 'city', 'exact')),
  exif_removed_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.book_context_chunks (
  id bigint generated always as identity primary key,
  book_id uuid not null references public.books(id) on delete cascade,
  version_id uuid references public.book_versions(id) on delete cascade,
  page_id text not null,
  page_number integer not null check (page_number > 0),
  asset_id uuid references public.book_assets(id) on delete cascade,
  content_type text not null check (content_type in ('title', 'caption', 'handwriting', 'image_description', 'location', 'saved_source')),
  searchable_text text not null,
  visibility public.context_visibility not null,
  embedding extensions.vector(1536),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint public_chunk_has_version check (visibility = 'draft' or version_id is not null)
);

create index book_context_chunks_lookup on public.book_context_chunks (book_id, visibility, version_id, page_number);
create index book_context_chunks_embedding on public.book_context_chunks using hnsw (embedding vector_cosine_ops);

create or replace function public.match_book_context_chunks(
  query_embedding extensions.vector(1536),
  match_book_id uuid,
  match_visibility public.context_visibility,
  match_version_id uuid default null,
  match_count integer default 8
)
returns table (id bigint, page_id text, page_number integer, content_type text, searchable_text text, similarity double precision)
language sql
stable
set search_path = ''
as $$
  select chunk.id, chunk.page_id, chunk.page_number, chunk.content_type, chunk.searchable_text,
    1 - (chunk.embedding <=> query_embedding) as similarity
  from public.book_context_chunks as chunk
  where chunk.book_id = match_book_id
    and chunk.visibility = match_visibility
    and (match_visibility = 'draft' or chunk.version_id = match_version_id)
    and chunk.embedding is not null
  order by chunk.embedding <=> query_embedding
  limit least(greatest(match_count, 1), 20);
$$;

create table public.ai_usage_daily (
  user_id uuid not null references auth.users(id) on delete cascade,
  book_id uuid not null references public.books(id) on delete cascade,
  usage_date date not null default current_date,
  request_count integer not null default 0 check (request_count >= 0),
  input_tokens bigint not null default 0 check (input_tokens >= 0),
  output_tokens bigint not null default 0 check (output_tokens >= 0),
  primary key (user_id, book_id, usage_date)
);

create table public.ai_query_events (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  book_id uuid not null references public.books(id) on delete cascade,
  version_id uuid references public.book_versions(id) on delete set null,
  mode public.context_visibility not null,
  question_hash text not null,
  status text not null check (status in ('ok', 'blocked', 'quota', 'error')),
  latency_ms integer,
  input_tokens integer,
  output_tokens integer,
  cache_hit boolean not null default false,
  error_code text,
  created_at timestamptz not null default now(),
  constraint no_raw_conversation_fields check (length(question_hash) >= 32)
);

comment on table public.ai_query_events is 'Operational metadata only. Never store raw questions, answers, or chat transcripts.';

alter table public.books enable row level security;
alter table public.book_versions enable row level security;
alter table public.book_assets enable row level security;
alter table public.book_context_chunks enable row level security;
alter table public.ai_usage_daily enable row level security;
alter table public.ai_query_events enable row level security;

create policy "authors manage their books" on public.books
  for all using (author_id = auth.uid()) with check (author_id = auth.uid());
create policy "read public book metadata" on public.books
  for select using (visibility = 'public' and current_version_id is not null);

create policy "authors manage versions" on public.book_versions
  for all using (exists (select 1 from public.books where books.id = book_versions.book_id and books.author_id = auth.uid()))
  with check (exists (select 1 from public.books where books.id = book_versions.book_id and books.author_id = auth.uid()));
create policy "read current public version" on public.book_versions
  for select using (exists (select 1 from public.books where books.current_version_id = book_versions.id and books.visibility = 'public'));

create policy "owners manage assets" on public.book_assets
  for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());

create policy "authors read all context" on public.book_context_chunks
  for select using (exists (select 1 from public.books where books.id = book_context_chunks.book_id and books.author_id = auth.uid()));
create policy "read current public context" on public.book_context_chunks
  for select using (
    visibility = 'published'
    and exists (select 1 from public.books where books.id = book_context_chunks.book_id and books.current_version_id = book_context_chunks.version_id and books.visibility = 'public')
  );

create policy "users read own usage" on public.ai_usage_daily for select using (user_id = auth.uid());
create policy "users read own query metadata" on public.ai_query_events for select using (user_id = auth.uid());

-- Inserts and quota increments for AI tables run through SECURITY DEFINER RPCs or the service role.
-- Storage buckets should be private: photobook-originals, photobook-derivatives, and exports.
