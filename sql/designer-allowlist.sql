-- Designer list: who may use Slideshot as a designer, and their team. Step 1 of 2 (step 2: members-only.sql).
-- Slack sign-up is open to every @24slides.com account, so this list (plus the DM list) decides who gets in.
--   - public.designer_allowlist is the source of truth (from Inner Platform via Metabase; no client access).
--   - A listed designer gets their team in public.profiles automatically (no "Choose your team"), now and at their first sign-in.
--   - public.is_member(): true for DMs (design_managers), listed designers and listed DMs. The add-in asks it after
--     sign-in and shows a no-access message when false; members-only.sql makes the database enforce it.
-- Run after dm-allowlist.sql. Safe to run again. The last query shows who would lose access in step 2.

-- 1. The list
create table if not exists public.designer_allowlist (
  email      text primary key check (email = lower(email)),
  name       text not null,
  team       text not null references public.teams(name),
  created_at timestamptz not null default now()
);
alter table public.designer_allowlist enable row level security;   -- no policies: clients can't read or write it
revoke all on public.designer_allowlist from anon, authenticated;

-- 2. Give one listed email its team (if the account exists); the list wins over a team picked by hand
create or replace function public.designer_allowlist_apply(p_email text) returns void
  language plpgsql security definer set search_path = public as $$
declare a public.designer_allowlist; uid uuid;
begin
  select * into a from public.designer_allowlist where email = lower(p_email);
  if not found then return; end if;
  select id into uid from auth.users where lower(email) = a.email;
  if uid is null then return; end if;                       -- no account yet: the auth.users trigger applies it later
  insert into public.profiles (user_id, name, team) values (uid, a.name, a.team)
    on conflict (user_id) do update set team = excluded.team, updated_at = now();   -- keep the name they already use
end $$;

create or replace function public.designer_allowlist_sync() returns trigger
  language plpgsql security definer set search_path = public as $$
begin
  perform public.designer_allowlist_apply(new.email);
  return null;
end $$;
drop trigger if exists designer_allowlist_sync on public.designer_allowlist;
create trigger designer_allowlist_sync after insert or update on public.designer_allowlist
  for each row execute function public.designer_allowlist_sync();

create or replace function public.designer_allowlist_new_user() returns trigger
  language plpgsql security definer set search_path = public as $$
begin
  begin
    perform public.designer_allowlist_apply(new.email);
  exception when others then
    raise warning 'designer_allowlist: % for %', sqlerrm, new.email;   -- never block creating an account
  end;
  return null;
end $$;
drop trigger if exists designer_allowlist_new_user on auth.users;
create trigger designer_allowlist_new_user after insert on auth.users
  for each row execute function public.designer_allowlist_new_user();
-- (Someone on both lists ends with the DM list's team: dm_allowlist_new_user runs after this trigger.)

-- 3. Who is a member: DMs, listed designers, listed DMs
create or replace function public.is_member() returns boolean
  language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.design_managers where user_id = auth.uid())
      or exists (select 1 from auth.users u where u.id = auth.uid()
                  and (lower(u.email) in (select email from public.designer_allowlist)
                    or lower(u.email) in (select email from public.dm_allowlist)))
$$;
revoke execute on function public.is_member() from public, anon;
grant execute on function public.is_member() to authenticated;

-- 4. The designers (from Inner Platform, 18 Nov 2026): 110 designers in 24 teams
insert into public.designer_allowlist (email, name, team) values
  ('fachrezi@24slides.com',      'Fahrezi Andika',              'Ablaze'),
  ('hapsari@24slides.com',       'Hapsari M',                   'Ablaze'),
  ('mifta@24slides.com',         'Miftakhul Jannah',            'Ablaze'),
  ('rachma@24slides.com',        'Rachmadya Dana Icthiarie',    'Ablaze'),
  ('vira@24slides.com',          'Savira Mustikaning',          'Ablaze'),
  ('tidar@24slides.com',         'Tidar Maulana Wirahadi',      'Ablaze'),
  ('alif@24slides.com',          'Alif Putra Azhari',           'Alpha'),
  ('audrey@24slides.com',        'Audrey Carissa',              'Alpha'),
  ('dio@24slides.com',           'Dio Ekky',                    'Alpha'),
  ('fitri@24slides.com',         'Fitri Mawar',                 'Alpha'),
  ('wisnu@24slides.com',         'Hendri Wisnu',                'Alpha'),
  ('nindy@24slides.com',         'Nindy Alvi',                  'Alpha'),
  ('alwan@24slides.com',         'Alwan Zaidan',                'Avvenger'),
  ('asmaul@24slides.com',        'Asmaul Nurul Hidayah',        'Avvenger'),
  ('bela@24slides.com',          'Bela Meriskha',               'Avvenger'),
  ('firman@24slides.com',        'Firmansyah Dhani',            'Avvenger'),
  ('maman@24slides.com',         'Firmansyah Putra Maulana',    'Avvenger'),
  ('try@24slides.com',           'Andika Try',                  'Bright'),
  ('firjatullah@24slides.com',   'Firjatullah Maulana',         'Bright'),
  ('iiq@24slides.com',           'Iqtiani Rufiana Zahra',       'Bright'),
  ('tio@24slides.com',           'Tio Dwi Nata',                'Bright'),
  ('wulan@24slides.com',         'Triwulan Anggraini',          'Bright'),
  ('yunis@24slides.com',         'Yunis Bagus Normawan',        'Bright'),
  ('nana@24slides.com',          'Agusmiyana Merdekawati',      'Cascade'),
  ('daniela@24slides.com',       'Daniela Febrata',             'Cascade'),
  ('devita@24slides.com',        'Devita Miranda',              'Cascade'),
  ('nikola@24slides.com',        'Nikola Ariela',               'Cascade'),
  ('tita@24slides.com',          'Diatitianati',                'Clementine'),
  ('dimasputra@24slides.com',    'Dimas Putra Bagus Wedi',      'Clementine'),
  ('fajar@24slides.com',         'Fajar Aditama',               'Clementine'),
  ('mathias@24slides.com',       'Mathias Respati',             'Clementine'),
  ('adindafirda@24slides.com',   'Adinda Firda',                'Clover'),
  ('rizaldwi@24slides.com',      'Ahmad Rizal',                 'Clover'),
  ('luluk@24slides.com',         'Lu''luul Maknun',             'Clover'),
  ('nadia@24slides.com',         'Nadia Tamara',                'Clover'),
  ('anwarsyaroni@24slides.com',  'Anwar Sya''roni',             'Cosmic'),
  ('bagus@24slides.com',         'Bagus Agung Pamungkas',       'Cosmic'),
  ('ria@24slides.com',           'Ria Dwi Renita',              'Cosmic'),
  ('diajeng@24slides.com',       'Diajeng Nawang',              'Fortis'),
  ('elyak@24slides.com',         'Elya Tri Nuraeni',            'Fortis'),
  ('resgy@24slides.com',         'Resgy',                       'Fortis'),
  ('rare@24slides.com',          'Rezzarare',                   'Fortis'),
  ('uddin@24slides.com',         'Achmad Fahruddin',            'Fourtastic'),
  ('adit@24slides.com',          'Aditya Rezki Apriyadi',       'Fourtastic'),
  ('benedict@24slides.com',      'Benedictus D.',               'Fourtastic'),
  ('galan@24slides.com',         'Galan Hastoro',               'Fourtastic'),
  ('ivana@24slides.com',         'Ivana Yen',                   'Fourtastic'),
  ('abdul@24slides.com',         'Abdul Hakim',                 'Horme'),
  ('ardipudji@24slides.com',     'Ardi Pudjiprayogo',           'Horme'),
  ('dwisuryo@24slides.com',      'Dwi Suryo Sumbodo',           'Horme'),
  ('renny@24slides.com',         'Renny Dwi',                   'Horme'),
  ('irma@24slides.com',          'Irma Andri',                  'Hustle'),
  ('rhey@24slides.com',          'L''Rhey Asmara',              'Hustle'),
  ('nina@24slides.com',          'Nina Candra',                 'Hustle'),
  ('ruth@24slides.com',          'Ruth Kristina',               'Hustle'),
  ('yoni@24slides.com',          'Yoni Prayoga',                'Hustle'),
  ('jaya@24slides.com',          'Adhistira Atmajaya',          'Jackdaw'),
  ('dwiyani@24slides.com',       'Dwi Yani',                    'Jackdaw'),
  ('hakky@24slides.com',         'Hakky',                       'Jackdaw'),
  ('selly@24slides.com',         'Selly Aulia',                 'Jackdaw'),
  ('wasesa@24slides.com',        'Wasesa Amimaitreya',          'Jackdaw'),
  ('dindatri@24slides.com',      'Dinda Tri Zuan',              'Magnetic'),
  ('fahrizal@24slides.com',      'Fahrizal Antovian',           'Magnetic'),
  ('niken@24slides.com',         'Niken Mega',                  'Magnetic'),
  ('reno@24slides.com',          'Reno Yuansyah',               'Magnetic'),
  ('resmia@24slides.com',        'Resmia Trirahma - Mia',       'Magnetic'),
  ('oka@24slides.com',           'Oka Putra',                   'Meraki'),
  ('ritdza@24slides.com',        'Ritdza Wilujeng',             'Meraki'),
  ('tahriz@24slides.com',        'Tahrizul Amin',               'Meraki'),
  ('vikhi@24slides.com',         'Vikhi Fikraturrosyida',       'Meraki'),
  ('azel@24slides.com',          'Azellia Fara',                'Nucleonz'),
  ('billy@24slides.com',         'Billy',                       'Nucleonz'),
  ('handy@24slides.com',         'Handy Priyanto',              'Nucleonz'),
  ('rezadwi@24slides.com',       'Reza Dwi',                    'Nucleonz'),
  ('rozi@24slides.com',          'Rozi',                        'Nucleonz'),
  ('amru@24slides.com',          'Amrullah Aziz Artadinata',    'Phoenix'),
  ('ardhian@24slides.com',       'Ardhian Zahroni',             'Phoenix'),
  ('azam@24slides.com',          'Muhammad Azamuddin Tiffany',  'Phoenix'),
  ('novi@24slides.com',          'Novi Rahmatika',              'Phoenix'),
  ('siti@24slides.com',          'Siti Nur Hasanah',            'Phoenix'),
  ('addinia@24slides.com',       'Addinia Shalsabila',          'Radiant'),
  ('siska@24slides.com',         'Anita Siska Listiyaningrum',  'Radiant'),
  ('arya@24slides.com',          'Arya Bisma',                  'Radiant'),
  ('endar@24slides.com',         'Endar Gayuh',                 'Radiant'),
  ('resita@24slides.com',        'Resita',                      'Radiant'),
  ('danang@24slides.com',        'Danang Kusuma',               'Sirius'),
  ('fery@24slides.com',          'Fery Irawan',                 'Sirius'),
  ('jery@24slides.com',          'Jery Jansen',                 'Sirius'),
  ('rifky@24slides.com',         'Rifky Adi',                   'Sirius'),
  ('ardhi@24slides.com',         'Ardhi Firmansyah',            'Titant'),
  ('ivan@24slides.com',          'Ivan Arifin',                 'Titant'),
  ('putri@24slides.com',         'Putri',                       'Titant'),
  ('may@24slides.com',           'Siti Maisyaroh',              'Titant'),
  ('alma@24slides.com',          'Alma Dian',                   'Vincero'),
  ('hilda@24slides.com',         'Hildayatun Nadia',            'Vincero'),
  ('hasnun@24slides.com',        'Ibna Fahimah Hasnun',         'Vincero'),
  ('alan@24slides.com',          'Maulana Akhmad',              'Vincero'),
  ('haris@24slides.com',         'Mufian Haris',                'Vincero'),
  ('nur@24slides.com',           'Nur Hariyanto',               'Vincero'),
  ('riki@24slides.com',          'Riki Mashudi',                'Vincero'),
  ('alfredo@24slides.com',       'Alfredo Calderon',            'Alpaka'),
  ('flavia@24slides.com',        'Flavia Rodriguez',            'Alpaka'),
  ('luismiguel@24slides.com',    'Luis Miguel',                 'Alpaka'),
  ('mayra@24slides.com',         'Mayra Paiva',                 'Alpaka'),
  ('carmen@24slides.com',        'Carmen Navarrete',            'Kaleido'),
  ('lucia@24slides.com',         'Lucia Mimbela',               'Kaleido'),
  ('rodrigo@24slides.com',       'Rodro Valle',                 'Kaleido'),
  ('andrea@24slides.com',        'Andrea Montero',              'Polaris'),
  ('antonio@24slides.com',       'Jose Diaz',                   'Polaris'),
  ('amadeus@24slides.com',       'Micael Ibarra',               'Polaris')
on conflict (email) do update set name = excluded.name, team = excluded.team;

-- 5. Check before step 2: accounts that exist but are on no list (they would lose access). Keep anyone who should stay:
--    a designer → insert into designer_allowlist; an admin → insert into design_managers (user_id).
select u.email, u.created_at, p.name, p.team
from auth.users u
left join public.profiles p on p.user_id = u.id
where not exists (select 1 from public.design_managers d where d.user_id = u.id)
  and lower(u.email) not in (select email from public.designer_allowlist)
  and lower(u.email) not in (select email from public.dm_allowlist)
order by u.created_at;

-- Later:
--   Add a designer:  insert into public.designer_allowlist (email, name, team) values ('new@24slides.com', 'Full Name', 'Cosmic');
--   Move teams:      update public.designer_allowlist set team = 'Alpha' where email = 'new@24slides.com';
--   Remove:          delete from public.designer_allowlist where email = 'new@24slides.com';   (no access from then on, once step 2 has run)
