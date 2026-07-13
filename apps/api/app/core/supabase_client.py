from functools import lru_cache

from supabase import Client, create_client

from app.core.config import get_settings


@lru_cache
def get_supabase() -> Client:
    """Server-side Supabase client using the service role key.

    Runs on the backend only — never expose the service key to the frontend.
    RLS is bypassed here by design; the API layer is the trust boundary and
    enforces organizer scoping itself (see repositories).
    """
    settings = get_settings()
    return create_client(settings.supabase_url, settings.supabase_service_key)
