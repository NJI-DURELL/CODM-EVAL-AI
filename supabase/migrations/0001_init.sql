-- OG Clan Engines — initial schema
-- Clans register up to 5 named teams; teams roster players; matches belong
-- to a tournament; screenshots are OCR'd into match_results/player_match_stats.

create extension if not exists pgcrypto;

-- ─── tournaments ─────────────────────────────────────────────────────────
create table tournaments (
  id uuid primary key default gen_random_uuid(),
  organizer_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  logo_url text,
  event_date date,
  placement_points jsonb not null default '{"1":10,"2":8,"3":7,"4":6,"5":5,"6":4,"7":3,"8":2,"9":1,"10":1}',
  kill_point_value numeric not null default 1,
  status text not null default 'active',
  created_at timestamptz not null default now()
);
create index idx_tournaments_organizer on tournaments (organizer_id);

-- ─── clans ───────────────────────────────────────────────────────────────
create table clans (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references tournaments (id) on delete cascade,
  name text not null,
  logo_url text
);
create index idx_clans_tournament on clans (tournament_id);

-- ─── teams (max 5 per clan, each with its own name) ─────────────────────
create table teams (
  id uuid primary key default gen_random_uuid(),
  clan_id uuid not null references clans (id) on delete cascade,
  name text not null,
  unique (clan_id, name)
);
create index idx_teams_clan on teams (clan_id);

create or replace function enforce_max_teams_per_clan()
returns trigger as $$
begin
  if (select count(*) from teams where clan_id = new.clan_id) >= 5 then
    raise exception 'Clan already has the maximum of 5 registered teams';
  end if;
  return new;
end;
$$ language plpgsql;

create trigger trg_max_teams_per_clan
before insert on teams
for each row execute function enforce_max_teams_per_clan();

-- ─── players ─────────────────────────────────────────────────────────────
create table players (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references teams (id) on delete cascade,
  name text not null,
  ign text
);
create index idx_players_team on players (team_id);

-- ─── matches ─────────────────────────────────────────────────────────────
create table matches (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references tournaments (id) on delete cascade,
  match_number int not null,
  unique (tournament_id, match_number)
);
create index idx_matches_tournament on matches (tournament_id);

-- ─── screenshots ─────────────────────────────────────────────────────────
create table screenshots (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references matches (id) on delete cascade,
  team_id uuid not null references teams (id) on delete cascade,
  storage_path text not null,
  content_hash text not null,
  ocr_status text not null default 'uploading',
  raw_ocr_json jsonb,
  error_message text,
  created_at timestamptz not null default now(),
  unique (match_id, content_hash)
);
create index idx_screenshots_match on screenshots (match_id);

-- ─── match_results / player_match_stats (confirmed, post-review data) ───
create table match_results (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references matches (id) on delete cascade,
  team_id uuid not null references teams (id) on delete cascade,
  placement int not null,
  team_kills int not null default 0,
  confirmed boolean not null default false,
  created_at timestamptz not null default now(),
  unique (match_id, team_id)
);
create index idx_match_results_match on match_results (match_id);
create index idx_match_results_team on match_results (team_id);

create table player_match_stats (
  id uuid primary key default gen_random_uuid(),
  match_result_id uuid not null references match_results (id) on delete cascade,
  player_id uuid not null references players (id) on delete cascade,
  kills int not null default 0,
  confirmed boolean not null default false,
  unique (match_result_id, player_id)
);
create index idx_player_match_stats_player on player_match_stats (player_id);

-- ─── leaderboard views (always computed fresh, no duplicated state) ─────
create or replace view team_leaderboard_view as
select
  tr.id as tournament_id,
  tm.id as team_id,
  tm.name as team_name,
  c.name as clan_name,
  count(mr.id)::int as games_played,
  coalesce(sum(mr.team_kills), 0)::int as total_kills,
  coalesce(sum((tr.placement_points ->> mr.placement::text)::numeric), 0) as placement_points,
  (coalesce(sum(mr.team_kills), 0) * tr.kill_point_value) as kill_points,
  coalesce(sum((tr.placement_points ->> mr.placement::text)::numeric), 0)
    + (coalesce(sum(mr.team_kills), 0) * tr.kill_point_value) as total_points
from teams tm
join clans c on c.id = tm.clan_id
join tournaments tr on tr.id = c.tournament_id
left join match_results mr on mr.team_id = tm.id and mr.confirmed = true
group by tr.id, tm.id, tm.name, c.name, tr.kill_point_value;

create or replace view player_leaderboard_view as
select
  tr.id as tournament_id,
  p.id as player_id,
  p.name as player_name,
  tm.name as team_name,
  count(pms.id)::int as games_played,
  coalesce(sum(pms.kills), 0)::int as total_kills,
  case when count(pms.id) > 0
    then coalesce(sum(pms.kills), 0)::numeric / count(pms.id)
    else 0
  end as avg_kills_per_game
from players p
join teams tm on tm.id = p.team_id
join clans c on c.id = tm.clan_id
join tournaments tr on tr.id = c.tournament_id
left join player_match_stats pms on pms.player_id = p.id and pms.confirmed = true
group by tr.id, p.id, p.name, tm.name;

-- ─── row level security ──────────────────────────────────────────────────
-- The FastAPI backend uses the Supabase service role key (bypasses RLS) and
-- enforces organizer scoping itself. These policies are a defense-in-depth
-- backstop for any future direct-from-client Supabase access.
alter table tournaments enable row level security;
create policy "Organizers manage own tournaments" on tournaments
  for all using (organizer_id = auth.uid()) with check (organizer_id = auth.uid());

alter table clans enable row level security;
create policy "Organizers manage own clans" on clans
  for all using (exists (
    select 1 from tournaments t where t.id = clans.tournament_id and t.organizer_id = auth.uid()
  )) with check (exists (
    select 1 from tournaments t where t.id = clans.tournament_id and t.organizer_id = auth.uid()
  ));

alter table teams enable row level security;
create policy "Organizers manage own teams" on teams
  for all using (exists (
    select 1 from clans c join tournaments t on t.id = c.tournament_id
    where c.id = teams.clan_id and t.organizer_id = auth.uid()
  )) with check (exists (
    select 1 from clans c join tournaments t on t.id = c.tournament_id
    where c.id = teams.clan_id and t.organizer_id = auth.uid()
  ));

alter table players enable row level security;
create policy "Organizers manage own players" on players
  for all using (exists (
    select 1 from teams tm join clans c on c.id = tm.clan_id join tournaments t on t.id = c.tournament_id
    where tm.id = players.team_id and t.organizer_id = auth.uid()
  )) with check (exists (
    select 1 from teams tm join clans c on c.id = tm.clan_id join tournaments t on t.id = c.tournament_id
    where tm.id = players.team_id and t.organizer_id = auth.uid()
  ));

alter table matches enable row level security;
create policy "Organizers manage own matches" on matches
  for all using (exists (
    select 1 from tournaments t where t.id = matches.tournament_id and t.organizer_id = auth.uid()
  )) with check (exists (
    select 1 from tournaments t where t.id = matches.tournament_id and t.organizer_id = auth.uid()
  ));

alter table screenshots enable row level security;
create policy "Organizers manage own screenshots" on screenshots
  for all using (exists (
    select 1 from matches m join tournaments t on t.id = m.tournament_id
    where m.id = screenshots.match_id and t.organizer_id = auth.uid()
  )) with check (exists (
    select 1 from matches m join tournaments t on t.id = m.tournament_id
    where m.id = screenshots.match_id and t.organizer_id = auth.uid()
  ));

alter table match_results enable row level security;
create policy "Organizers manage own match results" on match_results
  for all using (exists (
    select 1 from matches m join tournaments t on t.id = m.tournament_id
    where m.id = match_results.match_id and t.organizer_id = auth.uid()
  )) with check (exists (
    select 1 from matches m join tournaments t on t.id = m.tournament_id
    where m.id = match_results.match_id and t.organizer_id = auth.uid()
  ));

alter table player_match_stats enable row level security;
create policy "Organizers manage own player match stats" on player_match_stats
  for all using (exists (
    select 1 from match_results mr join matches m on m.id = mr.match_id join tournaments t on t.id = m.tournament_id
    where mr.id = player_match_stats.match_result_id and t.organizer_id = auth.uid()
  )) with check (exists (
    select 1 from match_results mr join matches m on m.id = mr.match_id join tournaments t on t.id = m.tournament_id
    where mr.id = player_match_stats.match_result_id and t.organizer_id = auth.uid()
  ));
