from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict

DEFAULT_PLACEMENT_POINTS = {
    "1": 10,
    "2": 8,
    "3": 7,
    "4": 6,
    "5": 5,
    "6": 4,
    "7": 3,
    "8": 2,
    "9": 1,
    "10": 1,
}
DEFAULT_KILL_POINT_VALUE = 1


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    env: str = "development"
    log_level: str = "INFO"

    supabase_url: str
    supabase_service_key: str
    supabase_jwt_secret: str
    supabase_storage_bucket: str = "screenshots"

    allowed_origins: str = "http://localhost:3000"

    fuzzy_match_min_score: int = 80

    @property
    def allowed_origins_list(self) -> list[str]:
        return [origin.strip() for origin in self.allowed_origins.split(",") if origin.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()  # type: ignore[call-arg]
