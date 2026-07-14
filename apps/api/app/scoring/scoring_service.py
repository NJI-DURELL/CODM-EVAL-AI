from app.models.schemas import Awards, MatchType, PlayerLeaderboardRow, TeamLeaderboardRow


def split_match_points(
    match_type: MatchType,
    placement: int,
    team_kills: int,
    placement_points: dict[str, int],
    kill_point_value: float,
) -> tuple[float, float]:
    """Placement points and kill points a team earns for one match, respecting
    that match's scoring mode — a placement-only lobby scores zero kill
    points regardless of kills, and vice versa. Mirrors team_leaderboard_view
    (see supabase/migrations/0005_match_scoring_mode.sql) so the per-match
    results endpoint and the tournament-wide leaderboard always agree.
    """
    placement_score = placement_points.get(str(placement), 0) if match_type != "kills" else 0
    kill_score = team_kills * kill_point_value if match_type != "placement" else 0
    return placement_score, kill_score


def calculate_match_points(
    placement: int, team_kills: int, placement_points: dict[str, int], kill_point_value: float
) -> float:
    """Total points a team earns for a single "both" match: placement points
    + kills * kill point value.
    """
    placement_score, kill_score = split_match_points(
        "both", placement, team_kills, placement_points, kill_point_value
    )
    return placement_score + kill_score


def performance_review(
    match_type: MatchType,
    placement: int,
    team_kills: int,
    placement_points: float,
    kill_points: float,
) -> str:
    """A very short, deterministic one-liner summarizing a team's result for
    a single match — not a full stat breakdown, just enough to read the
    result at a glance without doing the math yourself.
    """
    if match_type == "placement":
        return f"Placed #{placement} — kills aren't scored in this placement-only lobby."
    if match_type == "kills":
        return f"{team_kills} kills — placement isn't scored in this kills-only lobby."

    if placement_points == 0 and kill_points == 0:
        return "No points scored this match."
    if placement_points >= kill_points * 1.5:
        return f"Placement carried the score — #{placement} finish, {team_kills} kills."
    if kill_points >= placement_points * 1.5:
        return f"Kills carried the score — {team_kills} kills, #{placement} finish."
    return f"Balanced performance — #{placement} finish with {team_kills} kills."


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
