-- Estante Retro — estrutura mínima para login e sincronização Supabase.
-- Execute uma vez no SQL Editor do projeto Supabase que a Estante usará.
-- A tabela armazena uma cópia por conta; o RLS restringe cada registro ao próprio usuário.

create table if not exists public.estante_cloud_data (
  user_id uuid primary key references auth.users(id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  revision bigint not null default 1
);

-- Atualização aditiva para instalações que já possuem dados sincronizados.
alter table public.estante_cloud_data
  add column if not exists revision bigint not null default 1;

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

-- Grava apenas se a revisão ainda for a que o dispositivo leu (compare-and-swap).
create or replace function public.estante_save_cloud_snapshot(
  p_expected_revision bigint,
  p_data jsonb
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_row public.estante_cloud_data%rowtype;
begin
  if v_user_id is null then
    raise exception 'Autenticação necessária';
  end if;
  if jsonb_typeof(p_data) <> 'object' then
    raise exception 'O conteúdo da coleção precisa ser um objeto JSON';
  end if;

  if p_expected_revision = 0 then
    insert into public.estante_cloud_data (user_id, data, updated_at, revision)
    values (v_user_id, p_data, now(), 1)
    on conflict (user_id) do nothing
    returning * into v_row;
    if found then
      return jsonb_build_object('saved', true, 'revision', v_row.revision, 'data', v_row.data, 'updated_at', v_row.updated_at);
    end if;
  else
    update public.estante_cloud_data
    set data = p_data, updated_at = now(), revision = revision + 1
    where user_id = v_user_id and revision = p_expected_revision
    returning * into v_row;
    if found then
      return jsonb_build_object('saved', true, 'revision', v_row.revision, 'data', v_row.data, 'updated_at', v_row.updated_at);
    end if;
  end if;

  select * into v_row
  from public.estante_cloud_data
  where user_id = v_user_id;
  if found then
    return jsonb_build_object('saved', false, 'revision', v_row.revision, 'data', v_row.data, 'updated_at', v_row.updated_at);
  end if;
  return jsonb_build_object('saved', false, 'revision', 0, 'data', null, 'updated_at', null);
end;
$$;

revoke all on function public.estante_save_cloud_snapshot(bigint, jsonb) from public, anon;
grant execute on function public.estante_save_cloud_snapshot(bigint, jsonb) to authenticated;
