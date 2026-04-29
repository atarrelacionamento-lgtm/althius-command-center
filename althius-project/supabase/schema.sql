-- =============================================================
-- Pipa Driven CRM — Schema inicial
-- Execute este arquivo no SQL Editor do seu projeto Supabase
-- =============================================================

-- -------------------------------------------------------
-- Tabela: profiles
-- Criada automaticamente via trigger ao registrar usuário
-- -------------------------------------------------------
create table if not exists public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  role        text not null default 'user' check (role in ('admin', 'user')),
  name        text,
  created_at  timestamptz not null default now()
);

-- -------------------------------------------------------
-- RLS: habilitar e definir políticas
-- -------------------------------------------------------
alter table public.profiles enable row level security;

-- Usuário lê apenas o próprio perfil
create policy "profiles: user can read own"
  on public.profiles
  for select
  using (auth.uid() = id);

-- Admin lê todos os perfis
create policy "profiles: admin can read all"
  on public.profiles
  for select
  using (
    exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and p.role = 'admin'
    )
  );

-- Usuário pode atualizar apenas o próprio perfil (exceto role)
create policy "profiles: user can update own"
  on public.profiles
  for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- Admin pode atualizar qualquer perfil
create policy "profiles: admin can update all"
  on public.profiles
  for update
  using (
    exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and p.role = 'admin'
    )
  );

-- -------------------------------------------------------
-- Trigger: criar profile automaticamente ao registrar usuário
-- -------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, role, name)
  values (
    new.id,
    'user',
    coalesce(new.raw_user_meta_data ->> 'name', null)
  );
  return new;
end;
$$;

create or replace trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
