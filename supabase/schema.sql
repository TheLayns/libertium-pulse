-- =====================================================================
-- Libertium Pulse v2 — Schéma Supabase
-- À exécuter dans le SQL Editor du dashboard Supabase (une seule fois).
-- =====================================================================

create extension if not exists citext;

-- ---------------------------------------------------------------------
-- Référentiels
-- ---------------------------------------------------------------------
create table if not exists bus (
  code text primary key,            -- 'L.EST', 'L.OUEST', ...
  label text not null
);

create table if not exists concessions (
  id text primary key,              -- slug ex. 'libertium-nantes-nord'
  name text not null,
  bu text not null references bus(code),
  city text,
  cp text,
  dept text,
  region text,
  lat double precision,
  lng double precision,
  resp text,
  phone text,
  email text,
  brands text[] default '{}',
  ateliers text[] default '{}',
  active boolean not null default true
);

-- Liste d'accès : e-mail -> rôle. Gérée par les admins depuis l'écran Admin.
create table if not exists access_list (
  email citext primary key,
  role text not null check (role in ('admin','direction','directeur_bu')),
  bu text references bus(code),
  display_name text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  check (role <> 'directeur_bu' or bu is not null)
);

-- Comptes / alias d'import : relie un nom trouvé dans un export à une cible.
-- Sert AUSSI de déclaration d'existence des comptes (concession sans ligne
-- 'ig' = pas de compte Instagram -> le score se renormalise).
create table if not exists account_aliases (
  id bigint generated always as identity primary key,
  channel text not null check (channel in ('fb','ig','ga4','gmb','lbc')),
  alias text not null,              -- ex. "Libertium Nantes Nord" (nom de la Page Meta)
  scope text not null check (scope in ('concession','bu','national')),
  target_id text not null,          -- concessions.id, bus.code ou 'NATIONAL'
  unique (channel, alias)
);

-- Journal des imports
create table if not exists imports (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  imported_by citext not null,
  source text not null check (source in ('meta_fb','meta_ig','ga4','gbp','lbc','seed','manual')),
  file_name text,
  month_min date,
  month_max date,
  row_count int not null default 0,
  status text not null default 'ok' check (status in ('ok','partial','failed')),
  report jsonb
);

-- ---------------------------------------------------------------------
-- Métriques mensuelles (cœur du modèle)
-- month = 1er jour du mois. season = année de septembre :
-- saison « 2025-26 » (sept 2025 -> août 2026) => season = 2025.
-- ---------------------------------------------------------------------
create table if not exists metrics_monthly (
  id bigint generated always as identity primary key,
  scope text not null check (scope in ('concession','bu','national')),
  target_id text not null,
  channel text not null check (channel in ('fb','ig','ga4','gmb','lbc')),
  month date not null check (extract(day from month) = 1),
  season int generated always as (
    extract(year from month)::int
      - case when extract(month from month) < 9 then 1 else 0 end
  ) stored,
  -- Réseaux sociaux (fb, ig)
  followers int,
  reach int,
  interactions int,
  posts int,
  -- Site web (ga4)
  sessions int,
  users int,
  -- Fiches Google (gmb)
  rating numeric(3,2),
  reviews_total int,
  reviews_new int,
  -- Leboncoin (lbc)
  leads int,
  ads_count int,
  views int,
  import_id bigint references imports(id),
  updated_at timestamptz not null default now(),
  unique (scope, target_id, channel, month)
);
create index if not exists metrics_by_season on metrics_monthly (season, channel);
create index if not exists metrics_by_target on metrics_monthly (target_id, month);

-- ---------------------------------------------------------------------
-- Fonctions d'aide RLS (SECURITY DEFINER : évite la récursion access_list)
-- ---------------------------------------------------------------------
create or replace function public.my_role() returns text
language sql stable security definer set search_path = public as $$
  select role from access_list
  where email = (auth.jwt()->>'email')::citext and active
$$;

create or replace function public.my_bu() returns text
language sql stable security definer set search_path = public as $$
  select bu from access_list
  where email = (auth.jwt()->>'email')::citext and active
$$;

-- Profil de l'utilisateur connecté (null si e-mail non autorisé)
create or replace function public.get_my_profile()
returns table (email citext, role text, bu text, display_name text)
language sql stable security definer set search_path = public as $$
  select email, role, bu, display_name from access_list
  where email = (auth.jwt()->>'email')::citext and active
$$;

-- Vérification AVANT l'envoi du lien magique (meilleure UX)
create or replace function public.email_is_allowed(p_email text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from access_list where email = p_email::citext and active)
$$;

-- ---------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------
alter table bus enable row level security;
alter table concessions enable row level security;
alter table access_list enable row level security;
alter table account_aliases enable row level security;
alter table imports enable row level security;
alter table metrics_monthly enable row level security;

-- access_list : chacun lit SA ligne ; les admins gèrent tout
create policy al_self_read on access_list for select to authenticated
  using (email = (auth.jwt()->>'email')::citext);
create policy al_admin_all on access_list for all to authenticated
  using (my_role() = 'admin') with check (my_role() = 'admin');

-- Référentiels : lecture pour tout utilisateur autorisé, écriture admin
create policy bus_read on bus for select to authenticated using (my_role() is not null);
create policy bus_admin on bus for all to authenticated
  using (my_role() = 'admin') with check (my_role() = 'admin');

create policy conc_read on concessions for select to authenticated using (my_role() is not null);
create policy conc_admin on concessions for all to authenticated
  using (my_role() = 'admin') with check (my_role() = 'admin');

create policy alias_read on account_aliases for select to authenticated using (my_role() is not null);
create policy alias_admin on account_aliases for all to authenticated
  using (my_role() = 'admin') with check (my_role() = 'admin');

-- Journal des imports : admin uniquement
create policy imports_admin on imports for all to authenticated
  using (my_role() = 'admin') with check (my_role() = 'admin');

-- Métriques : LA règle centrale
--  admin / direction  -> tout (y compris scope 'national')
--  directeur_bu       -> scope 'bu' de sa BU + scope 'concession' de ses concessions
--                        (scope 'national' : jamais matché -> invisible)
create policy metrics_read on metrics_monthly for select to authenticated using (
  my_role() in ('admin','direction')
  or (
    my_role() = 'directeur_bu' and (
      (scope = 'bu' and target_id = my_bu())
      or (scope = 'concession' and exists (
        select 1 from concessions c
        where c.id = metrics_monthly.target_id and c.bu = my_bu()
      ))
    )
  )
);
create policy metrics_admin_write on metrics_monthly for all to authenticated
  using (my_role() = 'admin') with check (my_role() = 'admin');

-- ---------------------------------------------------------------------
-- RPC d'import transactionnel : journal + upsert en une transaction.
-- p_meta = {source, file_name, month_min, month_max, report}
-- p_rows = [{scope, target_id, channel, month, ...colonnes métriques}]
-- ---------------------------------------------------------------------
create or replace function public.import_metrics(p_meta jsonb, p_rows jsonb)
returns bigint
language plpgsql security definer set search_path = public as $$
declare
  v_import_id bigint;
begin
  if my_role() <> 'admin' then
    raise exception 'forbidden';
  end if;

  insert into imports (imported_by, source, file_name, month_min, month_max, row_count, status, report)
  values (
    (auth.jwt()->>'email')::citext,
    p_meta->>'source',
    p_meta->>'file_name',
    nullif(p_meta->>'month_min','')::date,
    nullif(p_meta->>'month_max','')::date,
    jsonb_array_length(p_rows),
    coalesce(p_meta->>'status','ok'),
    p_meta->'report'
  )
  returning id into v_import_id;

  insert into metrics_monthly (scope, target_id, channel, month,
    followers, reach, interactions, posts,
    sessions, users,
    rating, reviews_total, reviews_new,
    leads, ads_count, views, import_id)
  select r.scope, r.target_id, r.channel, r.month,
    r.followers, r.reach, r.interactions, r.posts,
    r.sessions, r.users,
    r.rating, r.reviews_total, r.reviews_new,
    r.leads, r.ads_count, r.views, v_import_id
  from jsonb_to_recordset(p_rows) as r(
    scope text, target_id text, channel text, month date,
    followers int, reach int, interactions int, posts int,
    sessions int, users int,
    rating numeric, reviews_total int, reviews_new int,
    leads int, ads_count int, views int)
  on conflict (scope, target_id, channel, month) do update set
    followers = excluded.followers,
    reach = excluded.reach,
    interactions = excluded.interactions,
    posts = excluded.posts,
    sessions = excluded.sessions,
    users = excluded.users,
    rating = excluded.rating,
    reviews_total = excluded.reviews_total,
    reviews_new = excluded.reviews_new,
    leads = excluded.leads,
    ads_count = excluded.ads_count,
    views = excluded.views,
    import_id = v_import_id,
    updated_at = now();

  return v_import_id;
end $$;

-- ---------------------------------------------------------------------
-- Données initiales minimales : les 7 BU + le premier admin.
-- IMPORTANT : remplacer l'e-mail ci-dessous par le vôtre avant d'exécuter,
-- puis ajouter votre chef via l'écran Admin de l'application.
-- ---------------------------------------------------------------------
insert into bus (code, label) values
  ('L.EST','Libertium Est'), ('L.LOIRE','Libertium Loire'),
  ('L.OUEST','Libertium Ouest'), ('L.RENNES','Libertium Rennes'),
  ('L.STRASBOURG','Libertium Strasbourg'), ('L.SUD','Libertium Sud'),
  ('L.SUD-OUEST','Libertium Sud-Ouest')
on conflict (code) do nothing;

insert into access_list (email, role, bu, display_name) values
  ('nuxnux02290@gmail.com', 'admin', null, 'Laywens (admin)'),
  ('laywens.feriaux@gmail.com', 'direction', null, 'Test Direction'),
  ('layns971@gmail.com', 'directeur_bu', 'L.OUEST', 'Test Directeur L.OUEST')
on conflict (email) do nothing;
