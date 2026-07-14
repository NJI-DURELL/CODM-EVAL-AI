-- Organizers run lobbies that aren't scored the same way — some are
-- placement-only, some kills-only, some both. match_type lets the
-- leaderboard math respect that per match instead of always summing both
-- components. label is an optional organizer-entered name (e.g. "Grand
-- Finals") shown alongside the auto type badge to disambiguate lobbies.

alter table matches add column match_type text not null default 'both'
  check (match_type in ('placement', 'kills', 'both'));
alter table matches add column label text;

-- team_leaderboard_view: zero out the ineligible component per match. Player
-- kill totals (player_leaderboard_view) are unaffected — kills always count
-- there, regardless of a match's scoring mode (used for MVP).
drop view if exists team_leaderboard_view;
create or replace view team_leaderboard_view as
select
  tr.id as tournament_id,
  tm.id as team_id,
  tm.name as team_name,
  count(mr.id)::int as games_played,
  coalesce(sum(mr.team_kills), 0)::int as total_kills,
  coalesce(sum(
    case when m.match_type != 'kills'
      then (tr.placement_points ->> mr.placement::text)::numeric
      else 0
    end
  ), 0) as placement_points,
  coalesce(sum(
    case when m.match_type != 'placement' then mr.team_kills else 0 end
  ), 0) * tr.kill_point_value as kill_points,
  coalesce(sum(
    case when m.match_type != 'kills'
      then (tr.placement_points ->> mr.placement::text)::numeric
      else 0
    end
  ), 0)
    + coalesce(sum(
      case when m.match_type != 'placement' then mr.team_kills else 0 end
    ), 0) * tr.kill_point_value as total_points
from teams tm
join tournaments tr on tr.id = tm.tournament_id
left join match_results mr on mr.team_id = tm.id and mr.confirmed = true
left join matches m on m.id = mr.match_id
group by tr.id, tm.id, tm.name, tr.kill_point_value;
