from app.models.schemas import Awards, PlayerLeaderboardRow, TeamLeaderboardRow


def calculate_match_points(
    placement: int, team_kills: int, placement_points: dict[str, int], kill_point_value: float
) -> float:
    """Total points a team earns for a single match: placement points + kills * kill point value."""
    placement_score = placement_points.get(str(placement), 0)
    return placement_score + team_kills * kill_point_value


def _best_by(rows: list, key) -> object | None:
    """Picks the max by `key`. On a tie, `max` keeps the first maximal item
    encountered, so callers get a stable result as long as `rows` is in a
    consistent order (e.g. always sorted by name from the source view).
    """
    if not rows:
        return None
    return max(rows, key=key)


def compute_awards(
    team_rows: list[TeamLeaderboardRow], player_rows: list[PlayerLeaderboardRow]
) -> Awards:
    mvp = _best_by(player_rows, lambda r: r.total_kills)
    best_team = _best_by(team_rows, lambda r: r.total_points)
    most_kills_team = _best_by(team_rows, lambda r: r.total_kills)
    return Awards(mvp=mvp, best_team=best_team, most_kills_team=most_kills_team)
