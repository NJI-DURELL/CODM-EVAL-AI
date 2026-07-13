-- Remove clan pre-registration. Teams and players are no longer registered
-- by the organizer ahead of time — they're discovered from OCR'd screenshots
-- and reconciled during review, scoped directly to the tournament. Team
-- identity is inferred from player continuity (see app/services/ocr_service.py)
-- rather than OCR'ing a team name out of the image.
--
-- Only throwaway test data exists at this point, so this is a clean schema
-- rewrite rather than a data-preserving migration.

truncate table player_match_stats, match_results, screenshots, players, teams, clans cascade;

-- ─── teams: tournament-scoped, no clan, no 5-per-clan cap ────────────────
alter table teams drop constraint if exists teams_clan_id_fkey;
drop trigger if exists trg_max_teams_per_clan on teams;
drop function if exists enforce_max_teams_per_clan();

alter table teams drop column clan_id;
alter table teams add column tournament_id uuid not null references tournaments (id) on delete cascade;
create index idx_teams_tournament on teams (tournament_id);

drop table clans;

-- ─── screenshots: team isn't known until after OCR review + confirm ─────
alter table screenshots alter column team_id drop not null;

-- ─── leaderboard views: join tournaments directly, no clan_name ─────────
create or replace view team_leaderboard_view as
select
  tr.id as tournament_id,
  tm.id as team_id,
  tm.name as team_name,
  count(mr.id)::int as games_played,
  coalesce(sum(mr.team_kills), 0)::int as total_kills,
  coalesce(sum((tr.placement_points ->> mr.placement::text)::numeric), 0) as placement_points,
  (coalesce(sum(mr.team_kills), 0) * tr.kill_point_value) as kill_points,
  coalesce(sum((tr.placement_points ->> mr.placement::text)::numeric), 0)
    + (coalesce(sum(mr.team_kills), 0) * tr.kill_point_value) as total_points
from teams tm
join tournaments tr on tr.id = tm.tournament_id
left join match_results mr on mr.team_id = tm.id and mr.confirmed = true
group by tr.id, tm.id, tm.name, tr.kill_point_value;

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
join tournaments tr on tr.id = tm.tournament_id
left join player_match_stats pms on pms.player_id = p.id and pms.confirmed = true
group by tr.id, p.id, p.name, tm.name;

-- ─── row level security: rejoin through tournament_id directly ──────────
drop policy if exists "Organizers manage own teams" on teams;
create policy "Organizers manage own teams" on teams
  for all using (exists (
    select 1 from tournaments t where t.id = teams.tournament_id and t.organizer_id = auth.uid()
  )) with check (exists (
    select 1 from tournaments t where t.id = teams.tournament_id and t.organizer_id = auth.uid()
  ));

drop policy if exists "Organizers manage own players" on players;
create policy "Organizers manage own players" on players
  for all using (exists (
    select 1 from teams tm join tournaments t on t.id = tm.tournament_id
    where tm.id = players.team_id and t.organizer_id = auth.uid()
  )) with check (exists (
    select 1 from teams tm join tournaments t on t.id = tm.tournament_id
    where tm.id = players.team_id and t.organizer_id = auth.uid()
  ));
