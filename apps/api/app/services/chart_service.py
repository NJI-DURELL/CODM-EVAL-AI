import base64
import io

import matplotlib

matplotlib.use("Agg")  # headless rendering — no display server on the API host
import matplotlib.pyplot as plt

from app.models.schemas import PlayerLeaderboardRow, TeamLeaderboardRow

CAMEROON_GREEN = "#007A5E"
CAMEROON_RED = "#CE1126"
CAMEROON_YELLOW = "#FCD116"


def _fig_to_data_uri(fig) -> str:
    buffer = io.BytesIO()
    fig.savefig(buffer, format="png", dpi=150, bbox_inches="tight", transparent=True)
    plt.close(fig)
    encoded = base64.b64encode(buffer.getvalue()).decode("ascii")
    return f"data:image/png;base64,{encoded}"


def team_points_chart(teams: list[TeamLeaderboardRow], top_n: int = 10) -> str | None:
    if not teams:
        return None
    top = teams[:top_n]
    fig, ax = plt.subplots(figsize=(6, 3.2))
    ax.barh([t.team_name for t in reversed(top)], [t.total_points for t in reversed(top)], color=CAMEROON_GREEN)
    ax.set_xlabel("Total Points")
    ax.set_title("Team Standings")
    fig.tight_layout()
    return _fig_to_data_uri(fig)


def player_kills_chart(players: list[PlayerLeaderboardRow], top_n: int = 10) -> str | None:
    if not players:
        return None
    top = players[:top_n]
    fig, ax = plt.subplots(figsize=(6, 3.2))
    ax.barh(
        [p.player_name for p in reversed(top)],
        [p.total_kills for p in reversed(top)],
        color=CAMEROON_RED,
    )
    ax.set_xlabel("Total Kills")
    ax.set_title("Top Fraggers")
    fig.tight_layout()
    return _fig_to_data_uri(fig)
