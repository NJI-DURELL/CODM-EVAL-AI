-- A screenshot is CODM's RANK-tab grid view: it can contain many teams at
-- once (see app/ocr/codm_parser.py), so it never belonged to a single team.
-- team_id was already nullable (0003); now it's dropped entirely since team
-- identity lives per-result in match_results, not on the screenshot.

alter table screenshots drop column if exists team_id;
