from uuid import uuid4

from app.models.schemas import Player
from app.services.matching_service import MatchingService


def _player(name: str, ign: str | None = None) -> Player:
    return Player(id=uuid4(), team_id=uuid4(), name=name, ign=ign)


def test_match_finds_exact_name():
    service = MatchingService()
    roster = [_player("ShadowFox"), _player("NightHawk")]
    result = service.match("ShadowFox", roster)
    assert result.matched_name == "ShadowFox"
    assert not result.needs_review


def test_match_tolerates_minor_ocr_typos():
    service = MatchingService()
    roster = [_player("ShadowFox"), _player("NightHawk")]
    result = service.match("ShadovvFox", roster)  # OCR misread w -> vv
    assert result.matched_name == "ShadowFox"
    assert result.player_id is not None


def test_match_flags_low_confidence_for_review():
    service = MatchingService()
    roster = [_player("ShadowFox")]
    result = service.match("xQ9z##!!", roster)
    assert result.needs_review
    assert result.player_id is None


def test_match_with_empty_roster_needs_review():
    service = MatchingService()
    result = service.match("AnyName", [])
    assert result.needs_review
    assert result.player_id is None


def test_match_prefers_ign_over_name_when_present():
    service = MatchingService()
    roster = [_player(name="Real Name Joshua", ign="Skyline")]
    result = service.match("Skyline", roster)
    assert result.matched_name == "Skyline"
    assert result.player_id == roster[0].id
