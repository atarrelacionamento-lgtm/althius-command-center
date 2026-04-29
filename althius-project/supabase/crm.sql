-- =============================================================
-- Pipa Driven CRM — Módulo CRM (contacts, companies, deals)
-- Execute no SQL Editor do Supabase APÓS schema.sql
-- =============================================================

-- -------------------------------------------------------
-- Helper: verifica se o usuário atual é admin
-- -------------------------------------------------------
create or replace function public.is_admin()
returns boolean
language sql stable
security definer set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

-- -------------------------------------------------------
-- Tabela: funnels (funis de vendas — gerenciado por admin)
-- -------------------------------------------------------
create table if not exists public.funnels (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  created_at timestamptz not null default now()
);

alter table public.funnels enable row level security;

create policy "funnels: authenticated users can read"
  on public.funnels for select
  using (auth.role() = 'authenticated');

create policy "funnels: only admin can write"
  on public.funnels for all
  using (public.is_admin());

-- Funis padrão
insert into public.funnels (name) values
  ('Residencial'),
  ('Comercial'),
  ('Loteamento')
on conflict do nothing;

-- -------------------------------------------------------
-- Tabela: companies
-- -------------------------------------------------------
create table if not exists public.companies (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  cnpj       text,
  city       text,
  segment    text,
  website    text,
  owner_id   uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.companies enable row level security;

create policy "companies: user sees own or admin sees all"
  on public.companies for select
  using (owner_id = auth.uid() or public.is_admin());

create policy "companies: user inserts own"
  on public.companies for insert
  with check (owner_id = auth.uid());

create policy "companies: user updates own or admin updates all"
  on public.companies for update
  using (owner_id = auth.uid() or public.is_admin());

create policy "companies: admin deletes"
  on public.companies for delete
  using (public.is_admin());

create index if not exists companies_owner_id_idx on public.companies(owner_id);
create index if not exists companies_name_idx on public.companies using gin(to_tsvector('portuguese', name));

-- -------------------------------------------------------
-- Tabela: contacts
-- -------------------------------------------------------
create table if not exists public.contacts (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  role       text,                                            -- cargo
  email      text,
  whatsapp   text,
  company_id uuid references public.companies(id) on delete set null,
  source     text,
  owner_id   uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now()
);

-- Deduplicação por email (ignora NULL)
create unique index if not exists contacts_email_unique
  on public.contacts(email) where email is not null;

alter table public.contacts enable row level security;

create policy "contacts: user sees own or admin sees all"
  on public.contacts for select
  using (owner_id = auth.uid() or public.is_admin());

create policy "contacts: user inserts own"
  on public.contacts for insert
  with check (owner_id = auth.uid());

create policy "contacts: user updates own or admin updates all"
  on public.contacts for update
  using (owner_id = auth.uid() or public.is_admin());

create policy "contacts: admin deletes"
  on public.contacts for delete
  using (public.is_admin());

create index if not exists contacts_owner_id_idx on public.contacts(owner_id);
create index if not exists contacts_company_id_idx on public.contacts(company_id);

-- -------------------------------------------------------
-- Tabela: deals
-- -------------------------------------------------------
create table if not exists public.deals (
  id             uuid primary key default gen_random_uuid(),
  title          text not null,
  value          numeric(15, 2),
  stage          text not null default 'Qualificação',
  funnel_id      uuid references public.funnels(id) on delete set null,
  contact_id     uuid references public.contacts(id) on delete set null,
  company_id     uuid references public.companies(id) on delete set null,
  owner_id       uuid not null references public.profiles(id) on delete cascade,
  expected_close date,
  created_at     timestamptz not null default now()
);

alter table public.deals enable row level security;

create policy "deals: user sees own or admin sees all"
  on public.deals for select
  using (owner_id = auth.uid() or public.is_admin());

create policy "deals: user inserts own"
  on public.deals for insert
  with check (owner_id = auth.uid());

create policy "deals: user updates own or admin updates all"
  on public.deals for update
  using (owner_id = auth.uid() or public.is_admin());

create policy "deals: admin deletes"
  on public.deals for delete
  using (public.is_admin());

create index if not exists deals_owner_id_idx   on public.deals(owner_id);
create index if not exists deals_contact_id_idx on public.deals(contact_id);
create index if not exists deals_company_id_idx on public.deals(company_id);
create index if not exists deals_funnel_id_idx  on public.deals(funnel_id);
