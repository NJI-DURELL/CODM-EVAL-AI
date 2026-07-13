import os

# WeasyPrint needs GTK/Pango/Cairo at import time. The Docker image installs
# these via apt; on native Windows dev, Python 3.8+'s DLL search no longer
# honors PATH for a library's own dependencies, so a GTK3 runtime install
# needs to be registered explicitly. This is a no-op everywhere else.
if os.name == "nt" and (_gtk_bin := os.environ.get("GTK3_RUNTIME_BIN")):
    os.add_dll_directory(_gtk_bin)

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes import (
    clans,
    leaderboard,
    matches,
    players,
    reports,
    teams,
    tournaments,
    uploads,
)
from app.core.config import get_settings
from app.core.logging import configure_logging

configure_logging()
settings = get_settings()

app = FastAPI(title="OG Clan Engines API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(tournaments.router)
app.include_router(clans.router)
app.include_router(teams.router)
app.include_router(players.router)
app.include_router(matches.router)
app.include_router(uploads.router)
app.include_router(leaderboard.router)
app.include_router(reports.router)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}
