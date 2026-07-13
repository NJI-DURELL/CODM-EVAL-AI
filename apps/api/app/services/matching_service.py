from dataclasses import dataclass
from uuid import UUID

from rapidfuzz import fuzz, process

from app.core.config import get_settings
from app.models.schemas import Player


@dataclass
class MatchCandidate:
    player_id: UUID | None
    matched_name: str | None
    confidence: float
    needs_review: bool


class MatchingService:
    """Fuzzy-matches OCR'd in-game names against a team's registered roster.

    OCR text recognition is imperfect (glare, small fonts, special characters
    in CODM tags), so exact string matching would silently drop players.
    Anything below `fuzzy_match_min_score` is flagged for manual review
    instead of guessed at, per the "missing player names" error-handling
    requirement.
    """

    def __init__(self) -> None:
        self.min_score = get_settings().fuzzy_match_min_score

    def match(self, ocr_name: str, roster: list[Player]) -> MatchCandidate:
        if not roster:
            return MatchCandidate(player_id=None, matched_name=None, confidence=0.0, needs_review=True)

        choices = {str(p.id): (p.ign or p.name) for p in roster}
        best = process.extractOne(
            ocr_name, choices, scorer=fuzz.WRatio, score_cutoff=self.min_score
        )
        if best is None:
            return MatchCandidate(player_id=None, matched_name=None, confidence=0.0, needs_review=True)

        matched_name, score, player_id = best
        return MatchCandidate(
            player_id=UUID(player_id),
            matched_name=matched_name,
            confidence=score,
            needs_review=score < 90,
        )
