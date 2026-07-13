from uuid import uuid4

from app.models.schemas import PlayerLeaderboardRow, TeamLeaderboardRow
from app.scoring.scoring_service import calculate_match_points, compute_awards

PLACEMENT_POINTS = {"1": 10, "2": 8, "3": 7, "4": 6, "5": 5}
KILL_POINT_VALUE = 1


def _team_row(name: str, total_points: float, total_kills: int) -> TeamLeaderboardRow:
    return TeamLeaderboardRow(
        team_id=uuid4(),
        team_name=name,
        clan_name="Clan X",
        games_played=3,
        total_kills=total_kills,
        placement_points=0,
        kill_points=0,
        total_points=total_points,
    )


def _player_row(name: str, total_kills: int, games: int = 3) -> PlayerLeaderboardRow:
    return PlayerLeaderboardRow(
        player_id=uuid4(),
        player_name=name,
        team_name="Team A",
        games_played=games,
        total_kills=total_kills,
        avg_kills_per_game=total_kills / games,
    )


def test_calculate_match_points_combines_placement_and_kills():
    points = calculate_match_points(1, 8, PLACEMENT_POINTS, KILL_POINT_VALUE)
    assert points == 10 + 8


def test_calculate_match_points_unranked_placement_scores_zero_placement_points():
    points = calculate_match_points(20, 5, PLACEMENT_POINTS, KILL_POINT_VALUE)
    assert points == 0 + 5


def test_calculate_match_points_respects_custom_kill_point_value():
    points = calculate_match_points(3, 4, PLACEMENT_POINTS, kill_point_value=2)
    assert points == 7 + 8


def test_compute_awards_picks_highest_total_kills_as_mvp():
    players = [_player_row("Alpha", total_kills=10), _player_row("Bravo", total_kills=25)]
    awards = compute_awards([], players)
    assert awards.mvp.player_name == "Bravo"


def test_compute_awards_best_team_uses_total_points_not_kills():
    teams = [
        _team_row("Ravens", total_points=50, total_kills=40),
        _team_row("Wolves", total_points=60, total_kills=20),
    ]
    awards = compute_awards(teams, [])
    assert awards.best_team.team_name == "Wolves"


def test_compute_awards_most_kills_team_can_differ_from_best_team():
    teams = [
        _team_row("Ravens", total_points=50, total_kills=40),
        _team_row("Wolves", total_points=60, total_kills=20),
    ]
    awards = compute_awards(teams, [])
    assert awards.most_kills_team.team_name == "Ravens"
    assert awards.best_team.team_name != awards.most_kills_team.team_name


def test_compute_awards_handles_empty_leaderboards():
    awards = compute_awards([], [])
    assert awards.mvp is None
    assert awards.best_team is None
    assert awards.most_kills_team is None


def test_compute_awards_tie_break_is_deterministic():
    teams = [
        _team_row("Ravens", total_points=50, total_kills=50),
        _team_row("Wolves", total_points=50, total_kills=10),
    ]
    first = compute_awards(teams, [])
    second = compute_awards(teams, [])
    assert first.best_team.team_name == second.best_team.team_name
