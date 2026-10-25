-- Estante Retro — estrutura mínima para login e sincronização Supabase.
-- Execute uma vez no SQL Editor do projeto Supabase que a Estante usará.
-- A tabela armazena uma cópia por conta; o RLS restringe cada registro ao próprio usuário.

create table if not exists public.estante_cloud_data (
  user_id uuid primary key references auth.users(id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.estante_cloud_data enable row level security;

revoke all on table public.estante_cloud_data from anon;
grant select, insert, update on table public.estante_cloud_data to authenticated;

drop policy if exists "Estante users can read own cloud data" on public.estante_cloud_data;
create policy "Estante users can read own cloud data"
  on public.estante_cloud_data for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Estante users can insert own cloud data" on public.estante_cloud_data;
create policy "Estante users can insert own cloud data"
  on public.estante_cloud_data for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "Estante users can update own cloud data" on public.estante_cloud_data;
create policy "Estante users can update own cloud data"
  on public.estante_cloud_data for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

comment on table public.estante_cloud_data is 'Dados sincronizados da Estante Retro, particionados por usuário autenticado.';
