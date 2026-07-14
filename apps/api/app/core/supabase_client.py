from functools import lru_cache

import httpx
from postgrest.utils import SyncClient
from supabase import Client, create_client

from app.core.config import get_settings


def _make_resilient(session: SyncClient) -> SyncClient:
    """Rebuilds a postgrest-py session without HTTP/2 and with retries.

    postgrest-py hardcodes http2=True with no way to opt out via
    ClientOptions. On this network, long-lived HTTP/2 connections to
    Supabase's edge intermittently die mid-request (httpcore
    RemoteProtocolError / ConnectionTerminated) — HTTP/1.1 with a retrying
    transport is far more stable here and costs nothing in correctness.
    """
    return SyncClient(
        base_url=session.base_url,
        headers=session.headers,
        timeout=session.timeout,
        follow_redirects=True,
        http2=False,
        transport=httpx.HTTPTransport(retries=3),
    )


@lru_cache
def get_supabase() -> Client:
    """Server-side Supabase client using the service role key.

    Runs on the backend only — never expose the service key to the frontend.
    RLS is bypassed here by design; the API layer is the trust boundary and
    enforces organizer scoping itself (see repositories).
    """
    settings = get_settings()
    client = create_client(settings.supabase_url, settings.supabase_service_key)
    client.postgrest.session = _make_resilient(client.postgrest.session)
    return client
