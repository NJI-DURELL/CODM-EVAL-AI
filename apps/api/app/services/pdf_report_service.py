from datetime import UTC, datetime
from pathlib import Path
from uuid import UUID

from jinja2 import Environment, FileSystemLoader
from weasyprint import HTML

from app.models.schemas import Awards, PlayerLeaderboardRow, TeamLeaderboardRow, Tournament
from app.repositories.clan_repository import ClanRepository
from app.repositories.leaderboard_repository import LeaderboardRepository
from app.repositories.match_repository import MatchRepository
from app.repositories.player_repository import PlayerRepository
from app.repositories.team_repository import TeamRepository
from app.scoring.scoring_service import compute_awards
from app.services.chart_service import player_kills_chart, team_points_chart

TEMPLATES_DIR = Path(__file__).parent / "templates"
_env = Environment(loader=FileSystemLoader(str(TEMPLATES_DIR)))


class PdfReportService:
    def __init__(
        self,
        leaderboard_repo: LeaderboardRepository,
        clan_repo: ClanRepository,
        team_repo: TeamRepository,
        player_repo: PlayerRepository,
        match_repo: MatchRepository,
    ):
        self.leaderboard_repo = leaderboard_repo
        self.clan_repo = clan_repo
        self.team_repo = team_repo
        self.player_repo = player_repo
        self.match_repo = match_repo

    def _team_and_clan_counts(self, tournament_id: UUID) -> tuple[int, int]:
        clans = self.clan_repo.list_for_tournament(tournament_id)
        team_count = sum(self.team_repo.count_for_clan(clan.id) for clan in clans)
        return len(clans), team_count

    def generate(self, tournament: Tournament) -> bytes:
        team_rows: list[TeamLeaderboardRow] = self.leaderboard_repo.team_leaderboard(tournament.id)
        player_rows: list[PlayerLeaderboardRow] = self.leaderboard_repo.player_leaderboard(tournament.id)
        awards: Awards = compute_awards(team_rows, player_rows)

        clan_count, team_count = self._team_and_clan_counts(tournament.id)
        matches = self.match_repo.list_for_tournament(tournament.id)
        total_kills = sum(row.total_kills for row in player_rows)

        template = _env.get_template("report.html")
        html_content = template.render(
            tournament_name=tournament.name,
            logo_url=tournament.logo_url,
            event_date=tournament.event_date.isoformat() if tournament.event_date else "TBD",
            generated_at=datetime.now(UTC).strftime("%Y-%m-%d %H:%M UTC"),
            summary={
                "clans": clan_count,
                "teams": team_count,
                "players": len(player_rows),
                "matches": len(matches),
                "total_kills": total_kills,
            },
            awards=awards,
            team_leaderboard=team_rows,
            player_leaderboard=player_rows,
            team_chart=team_points_chart(team_rows),
            player_chart=player_kills_chart(player_rows),
        )
        return HTML(string=html_content, base_url=str(TEMPLATES_DIR)).write_pdf()
